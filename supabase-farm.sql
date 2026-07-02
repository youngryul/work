-- 포실이 농장: 성장 단계, 경험치 이벤트, 젤리 소비(분유)

-- ─── 농장 설정 (관리자) ───
CREATE TABLE IF NOT EXISTS farm_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO farm_settings (key, value, label) VALUES
  ('stage_1_xp_required', '100', '1→2단계 필요 경험치'),
  ('stage_2_xp_required', '180', '2→3단계 필요 경험치'),
  ('stage_3_xp_required', '260', '3→4단계 필요 경험치'),
  ('stage_4_xp_required', '360', '4→5단계 필요 경험치'),
  ('stage_5_xp_required', '480', '5→6단계 필요 경험치'),
  ('stage_6_xp_required', '620', '6→7단계 필요 경험치'),
  ('stage_7_xp_required', '780', '7→8단계 필요 경험치'),
  ('stage_8_xp_required', '960', '8→9단계 필요 경험치'),
  ('stage_9_xp_required', '1160', '9→10단계 필요 경험치'),
  ('stage_1_image', '/images/아기포실이.png', '1단계 캐릭터 이미지'),
  ('stage_2_image', '/images/포실이.png', '2단계 이상 캐릭터 이미지')
ON CONFLICT (key) DO NOTHING;

-- ─── 경험치 이벤트 (관리자 CRUD) ───
CREATE TABLE IF NOT EXISTS farm_xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  xp_amount INTEGER NOT NULL DEFAULT 0 CHECK (xp_amount >= 0),
  jelly_cost INTEGER NOT NULL DEFAULT 0 CHECK (jelly_cost >= 0),
  min_stage INTEGER NOT NULL DEFAULT 1 CHECK (min_stage >= 1),
  max_stage INTEGER CHECK (max_stage IS NULL OR max_stage >= 1),
  trigger_type TEXT NOT NULL DEFAULT 'auto' CHECK (trigger_type IN ('manual', 'auto')),
  farm_area TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO farm_xp_events (event_key, label, description, xp_amount, jelly_cost, min_stage, max_stage, trigger_type, farm_area, sort_order) VALUES
  ('milk_feed', '먹이 주기', '젤리로 1단계는 분유, 2단계 이후는 음식 먹이기로 포실이를 다음 단계로 성장시켜요', 15, 3, 1, 9, 'manual', NULL, 0)
ON CONFLICT (event_key) DO NOTHING;

-- ─── 사용자 농장 진행 ───
CREATE TABLE IF NOT EXISTS user_farm_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL DEFAULT 1 CHECK (stage >= 1 AND stage <= 10),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  farm_unlocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 경험치 지급 이력 (자동 이벤트 중복 방지) ───
CREATE TABLE IF NOT EXISTS farm_xp_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  xp_amount INTEGER NOT NULL CHECK (xp_amount > 0),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_farm_xp_log_user_id ON farm_xp_log (user_id);

-- ─── 젤리 소비 이력 ───
CREATE TABLE IF NOT EXISTS jelly_spend_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_jelly_spend_log_user_id ON jelly_spend_log (user_id);

-- 젤리 지급 사유에 농장 추가
ALTER TABLE jelly_rewards_log DROP CONSTRAINT IF EXISTS jelly_rewards_log_reason_check;
ALTER TABLE jelly_rewards_log ADD CONSTRAINT jelly_rewards_log_reason_check
  CHECK (reason IN ('task_complete', 'diary_write', 'weight_record', 'weight_goal_reached', 'farm_refund'));

-- ─── RLS ───
ALTER TABLE farm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_xp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_farm_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_xp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE jelly_spend_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_farm_settings" ON farm_settings;
CREATE POLICY "users_read_farm_settings" ON farm_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admins_manage_farm_settings" ON farm_settings;
CREATE POLICY "admins_manage_farm_settings" ON farm_settings
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "users_read_active_farm_xp_events" ON farm_xp_events;
CREATE POLICY "users_read_active_farm_xp_events" ON farm_xp_events
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "admins_manage_farm_xp_events" ON farm_xp_events;
CREATE POLICY "admins_manage_farm_xp_events" ON farm_xp_events
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "users_read_own_farm_progress" ON user_farm_progress;
CREATE POLICY "users_read_own_farm_progress" ON user_farm_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_read_own_farm_xp_log" ON farm_xp_log;
CREATE POLICY "users_read_own_farm_xp_log" ON farm_xp_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_read_own_jelly_spend_log" ON jelly_spend_log;
CREATE POLICY "users_read_own_jelly_spend_log" ON jelly_spend_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ─── 젤리 소비 RPC ───
CREATE OR REPLACE FUNCTION spend_jelly(
  p_amount INTEGER,
  p_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance INTEGER;
  v_inserted BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION '소비 젤리는 1 이상이어야 합니다.';
  END IF;

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key가 필요합니다.';
  END IF;

  INSERT INTO user_jelly (user_id, balance)
  VALUES (v_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO jelly_spend_log (user_id, amount, reason, idempotency_key)
  VALUES (v_user_id, p_amount, p_reason, trim(p_idempotency_key))
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING true INTO v_inserted;

  IF NOT COALESCE(v_inserted, false) THEN
    SELECT balance INTO v_balance FROM user_jelly WHERE user_id = v_user_id;
    RETURN json_build_object(
      'balance', COALESCE(v_balance, 0),
      'spent', 0,
      'alreadySpent', true
    );
  END IF;

  UPDATE user_jelly
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE user_id = v_user_id AND balance >= p_amount
  RETURNING balance INTO v_balance;

  IF v_balance IS NULL THEN
    DELETE FROM jelly_spend_log
    WHERE user_id = v_user_id AND idempotency_key = trim(p_idempotency_key);
    RAISE EXCEPTION '젤리가 부족합니다.';
  END IF;

  RETURN json_build_object(
    'balance', v_balance,
    'spent', p_amount,
    'alreadySpent', false
  );
END;
$$;

-- ─── 농장 경험치 이벤트 처리 RPC (젤리 분유 → 10단계 성장) ───
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

-- ─── 농장 진행 조회 RPC ───
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

GRANT EXECUTE ON FUNCTION spend_jelly(INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_farm_xp_event(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_farm_progress() TO authenticated;

UPDATE role_menu_permissions
SET allowed_menu_ids = array_append(allowed_menu_ids, 'farm')
WHERE NOT ('farm' = ANY(allowed_menu_ids));

COMMENT ON TABLE user_farm_progress IS '사용자 포실이 농장 성장 진행';
COMMENT ON TABLE farm_xp_events IS '농장 경험치 이벤트 (관리자 설정)';
COMMENT ON TABLE farm_settings IS '농장 전역 설정';
