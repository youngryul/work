-- 농장 10단계 젤리 성장 + 활동 경험치 비활성화 마이그레이션

-- 단계별 필요 경험치 (N단계 → N+1단계)
INSERT INTO farm_settings (key, value, label) VALUES
  ('stage_1_xp_required', '100', '1→2단계 필요 경험치'),
  ('stage_2_xp_required', '180', '2→3단계 필요 경험치'),
  ('stage_3_xp_required', '260', '3→4단계 필요 경험치'),
  ('stage_4_xp_required', '360', '4→5단계 필요 경험치'),
  ('stage_5_xp_required', '480', '5→6단계 필요 경험치'),
  ('stage_6_xp_required', '620', '6→7단계 필요 경험치'),
  ('stage_7_xp_required', '780', '7→8단계 필요 경험치'),
  ('stage_8_xp_required', '960', '8→9단계 필요 경험치'),
  ('stage_9_xp_required', '1160', '9→10단계 필요 경험치')
ON CONFLICT (key) DO NOTHING;

-- 기존 값도 최신 난이도로 갱신
UPDATE farm_settings SET value = '100' WHERE key = 'stage_1_xp_required';
UPDATE farm_settings SET value = '180' WHERE key = 'stage_2_xp_required';
UPDATE farm_settings SET value = '260' WHERE key = 'stage_3_xp_required';
UPDATE farm_settings SET value = '360' WHERE key = 'stage_4_xp_required';
UPDATE farm_settings SET value = '480' WHERE key = 'stage_5_xp_required';
UPDATE farm_settings SET value = '620' WHERE key = 'stage_6_xp_required';
UPDATE farm_settings SET value = '780' WHERE key = 'stage_7_xp_required';
UPDATE farm_settings SET value = '960' WHERE key = 'stage_8_xp_required';
UPDATE farm_settings SET value = '1160' WHERE key = 'stage_9_xp_required';

-- 분유는 1~9단계에서 사용, 활동 자동 이벤트 비활성화
UPDATE farm_xp_events
SET is_active = false
WHERE trigger_type = 'auto';

UPDATE farm_xp_events
SET
  min_stage = 1,
  max_stage = 9,
  description = '젤리로 1단계는 분유, 2단계 이후는 음식 먹이기로 포실이를 성장시켜요',
  is_active = true
WHERE event_key = 'milk_feed';

-- 단계 상한 10
ALTER TABLE user_farm_progress DROP CONSTRAINT IF EXISTS user_farm_progress_stage_check;
ALTER TABLE user_farm_progress ADD CONSTRAINT user_farm_progress_stage_check
  CHECK (stage >= 1 AND stage <= 10);

-- 2단계 이상은 농장 해금 상태 유지
UPDATE user_farm_progress
SET farm_unlocked = true
WHERE stage >= 2;

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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  INSERT INTO user_farm_progress (user_id, stage, xp, farm_unlocked)
  VALUES (v_user_id, 1, 0, false)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_progress FROM user_farm_progress WHERE user_id = v_user_id;

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
    'nextStageXpRequired', v_threshold,
    'maxStage', 10
  );
END;
$$;
