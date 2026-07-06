-- 포실이 3단계 이상 먹이 젤리 5개 (1~2단계는 3개)

INSERT INTO farm_settings (key, value, label) VALUES
  ('milk_feed_jelly_cost_default', '3', '1~2단계 먹이 젤리'),
  ('milk_feed_jelly_cost_stage_3_plus', '5', '3단계 이상 먹이 젤리')
ON CONFLICT (key) DO NOTHING;

UPDATE farm_settings SET value = '5' WHERE key = 'milk_feed_jelly_cost_stage_3_plus';

CREATE OR REPLACE FUNCTION get_milk_feed_jelly_cost(p_stage INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cost INTEGER;
BEGIN
  IF COALESCE(p_stage, 1) >= 3 THEN
    SELECT COALESCE(value::INTEGER, 5) INTO v_cost
    FROM farm_settings
    WHERE key = 'milk_feed_jelly_cost_stage_3_plus';
    RETURN COALESCE(v_cost, 5);
  END IF;

  SELECT COALESCE(value::INTEGER, 3) INTO v_cost
  FROM farm_settings
  WHERE key = 'milk_feed_jelly_cost_default';
  RETURN COALESCE(v_cost, 3);
END;
$$;

-- process_farm_xp_event: milk_feed 단계별 젤리 (기존 배포본 기준 패치)
-- grant_stage2_welcome_seed 가 있는 최신 버전 기준
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
    'feedJellyCost', get_milk_feed_jelly_cost(v_progress.stage),
    'nextStageXpRequired', v_threshold,
    'maxStage', 10
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_milk_feed_jelly_cost(INTEGER) TO authenticated;
