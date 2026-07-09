-- 3단계 이후 포실이 단계 성장 시 씨앗 1개 지급

CREATE TABLE IF NOT EXISTS user_farm_stage_seed_grants (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL CHECK (stage >= 3 AND stage <= 10),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, stage)
);

ALTER TABLE user_farm_stage_seed_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own farm stage seed grants" ON user_farm_stage_seed_grants;
CREATE POLICY "Users can read own farm stage seed grants"
  ON user_farm_stage_seed_grants FOR SELECT
  USING (auth.uid() = user_id);

-- 단계별 성장 씨앗 지급 (3~10단계, 단계당 1회)
CREATE OR REPLACE FUNCTION grant_farm_stage_growth_seed(p_user_id UUID, p_stage INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_stage INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_stage IS NULL OR p_stage < 3 OR p_stage > 10 THEN
    RETURN 0;
  END IF;

  INSERT INTO user_farm_stage_seed_grants (user_id, stage)
  VALUES (p_user_id, p_stage)
  ON CONFLICT (user_id, stage) DO NOTHING
  RETURNING stage INTO v_inserted_stage;

  IF v_inserted_stage IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO user_farm_inventory (user_id, seed_count, welcome_seed_granted)
  VALUES (p_user_id, 0, false)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE user_farm_inventory
  SET seed_count = seed_count + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN 1;
END;
$$;

-- process_farm_xp_event: 3단계 이후 단계 성장 시 씨앗 지급
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
  v_feed_jelly_cost INTEGER := 0;
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

  IF p_event_key = 'milk_feed' THEN
    v_feed_jelly_cost := get_milk_feed_jelly_cost(v_progress.stage);
  ELSIF v_event.jelly_cost > 0 THEN
    v_feed_jelly_cost := v_event.jelly_cost;
  END IF;

  IF v_feed_jelly_cost > 0 THEN
    v_spend_key := 'farm:' || v_log_key;
    PERFORM spend_jelly(v_feed_jelly_cost, 'farm_' || p_event_key, v_spend_key);
    v_jelly_spent := v_feed_jelly_cost;
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
    ELSIF v_new_stage >= 3 THEN
      v_seed_granted := grant_farm_stage_growth_seed(v_user_id, v_new_stage);
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
    'feedJellyCost', get_milk_feed_jelly_cost(v_progress.stage),
    'nextStageXpRequired', CASE WHEN v_progress.stage >= 10 THEN NULL ELSE COALESCE(v_threshold, 100) END,
    'maxStage', 10
  );
END;
$$;

GRANT EXECUTE ON FUNCTION grant_farm_stage_growth_seed(UUID, INTEGER) TO authenticated;
