-- 2단계 달성 시 씨앗 1개 지급

CREATE TABLE IF NOT EXISTS user_farm_inventory (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  seed_count INTEGER NOT NULL DEFAULT 0 CHECK (seed_count >= 0),
  welcome_seed_granted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_farm_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_farm_inventory" ON user_farm_inventory;
CREATE POLICY "users_read_own_farm_inventory" ON user_farm_inventory
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 기존 2단계 이상 사용자에게 씨앗 1개 보정 지급 (최초 1회)
INSERT INTO user_farm_inventory (user_id, seed_count, welcome_seed_granted)
SELECT p.user_id, 1, true
FROM user_farm_progress p
WHERE p.stage >= 2
  AND NOT EXISTS (
    SELECT 1 FROM user_farm_inventory i
    WHERE i.user_id = p.user_id AND i.welcome_seed_granted = true
  )
ON CONFLICT (user_id) DO NOTHING;

UPDATE user_farm_inventory i
SET seed_count = i.seed_count + 1,
    welcome_seed_granted = true,
    updated_at = NOW()
FROM user_farm_progress p
WHERE p.user_id = i.user_id
  AND p.stage >= 2
  AND i.welcome_seed_granted = false;

CREATE OR REPLACE FUNCTION grant_stage2_welcome_seed(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_granted INTEGER := 0;
BEGIN
  INSERT INTO user_farm_inventory (user_id, seed_count, welcome_seed_granted)
  VALUES (p_user_id, 0, false)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE user_farm_inventory
  SET seed_count = seed_count + 1,
      welcome_seed_granted = true,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND welcome_seed_granted = false
  RETURNING 1 INTO v_granted;

  RETURN COALESCE(v_granted, 0);
END;
$$;

CREATE OR REPLACE FUNCTION process_farm_xp_event(
  p_event_key TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_event farm_xp_events%ROWTYPE;
  v_progress user_farm_progress%ROWTYPE;
  v_threshold INTEGER;
  v_setting_key TEXT;
  v_new_xp INTEGER;
  v_leveled_up BOOLEAN := false;
  v_jelly_spent INTEGER := 0;
  v_spend_key TEXT;
  v_log_key TEXT;
  v_new_stage INTEGER;
  v_seed_granted INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT * INTO v_event
  FROM farm_xp_events
  WHERE event_key = p_event_key AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION '유효하지 않은 농장 이벤트입니다.';
  END IF;

  INSERT INTO user_farm_progress (user_id, stage, xp, farm_unlocked)
  VALUES (v_user_id, 1, 0, false)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_progress FROM user_farm_progress WHERE user_id = v_user_id;

  IF v_progress.stage >= 10 THEN
    RAISE EXCEPTION '이미 최고 단계에 도달했습니다.';
  END IF;

  IF v_progress.stage < v_event.min_stage THEN
    RAISE EXCEPTION '아직 이 이벤트를 사용할 수 없는 단계입니다.';
  END IF;

  IF v_event.max_stage IS NOT NULL AND v_progress.stage > v_event.max_stage THEN
    RAISE EXCEPTION '이 단계에서는 사용할 수 없는 이벤트입니다.';
  END IF;

  IF v_event.trigger_type = 'auto' THEN
    RAISE EXCEPTION '자동 경험치 이벤트는 비활성화되었습니다.';
  END IF;

  v_log_key := COALESCE(
    NULLIF(trim(p_idempotency_key), ''),
    'manual:' || p_event_key || ':' || gen_random_uuid()::text
  );

  IF v_event.jelly_cost > 0 THEN
    v_spend_key := 'farm:' || v_log_key;
    PERFORM spend_jelly(v_event.jelly_cost, 'farm_' || p_event_key, v_spend_key);
    v_jelly_spent := v_event.jelly_cost;
  END IF;

  v_new_xp := v_progress.xp + v_event.xp_amount;
  v_setting_key := 'stage_' || v_progress.stage || '_xp_required';

  SELECT COALESCE(value::INTEGER, 100) INTO v_threshold
  FROM farm_settings
  WHERE key = v_setting_key;

  IF v_threshold IS NULL THEN
    v_threshold := 100;
  END IF;

  IF v_progress.stage < 10 AND v_new_xp >= v_threshold THEN
    v_leveled_up := true;
    v_new_stage := v_progress.stage + 1;

    UPDATE user_farm_progress
    SET stage = v_new_stage,
        xp = v_new_xp - v_threshold,
        farm_unlocked = v_new_stage >= 2,
        updated_at = NOW()
    WHERE user_id = v_user_id;

    IF v_new_stage = 2 THEN
      v_seed_granted := grant_stage2_welcome_seed(v_user_id);
    END IF;
  ELSE
    UPDATE user_farm_progress
    SET xp = v_new_xp,
        updated_at = NOW()
    WHERE user_id = v_user_id;
  END IF;

  INSERT INTO farm_xp_log (user_id, event_key, xp_amount, idempotency_key)
  VALUES (v_user_id, p_event_key, v_event.xp_amount, v_log_key);

  SELECT * INTO v_progress FROM user_farm_progress WHERE user_id = v_user_id;

  SELECT COALESCE(value::INTEGER, 100) INTO v_threshold
  FROM farm_settings
  WHERE key = 'stage_' || v_progress.stage || '_xp_required';

  RETURN json_build_object(
    'xp', v_progress.xp,
    'stage', v_progress.stage,
    'farmUnlocked', v_progress.farm_unlocked,
    'xpAwarded', v_event.xp_amount,
    'jellySpent', v_jelly_spent,
    'leveledUp', v_leveled_up,
    'alreadyAwarded', false,
    'seedGranted', v_seed_granted,
    'nextStageXpRequired', CASE WHEN v_progress.stage >= 10 THEN NULL ELSE COALESCE(v_threshold, 100) END,
    'maxStage', 10
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_my_farm_progress()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_progress user_farm_progress%ROWTYPE;
  v_threshold INTEGER;
  v_seed_count INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  INSERT INTO user_farm_progress (user_id, stage, xp, farm_unlocked)
  VALUES (v_user_id, 1, 0, false)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_progress FROM user_farm_progress WHERE user_id = v_user_id;

  IF v_progress.stage >= 2 THEN
    PERFORM grant_stage2_welcome_seed(v_user_id);
  END IF;

  SELECT COALESCE(seed_count, 0) INTO v_seed_count
  FROM user_farm_inventory
  WHERE user_id = v_user_id;

  IF v_progress.stage >= 10 THEN
    v_threshold := NULL;
  ELSE
    SELECT COALESCE(value::INTEGER, 100) INTO v_threshold
    FROM farm_settings
    WHERE key = 'stage_' || v_progress.stage || '_xp_required';
  END IF;

  RETURN json_build_object(
    'stage', v_progress.stage,
    'xp', v_progress.xp,
    'farmUnlocked', v_progress.farm_unlocked,
    'seedCount', v_seed_count,
    'nextStageXpRequired', v_threshold,
    'maxStage', 10
  );
END;
$$;

COMMENT ON TABLE user_farm_inventory IS '사용자 농장 인벤토리 (씨앗 등)';
