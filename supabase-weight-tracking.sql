-- 몸무게 기록 + 목표 + 젤리 연동

CREATE TABLE IF NOT EXISTS weight_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_date TEXT NOT NULL,
  weight_kg NUMERIC(5, 2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, record_date)
);

CREATE INDEX IF NOT EXISTS idx_weight_records_user_date
  ON weight_records (user_id, record_date DESC);

CREATE TABLE IF NOT EXISTS weight_goals (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_weight_kg NUMERIC(5, 2) NOT NULL CHECK (target_weight_kg > 0 AND target_weight_kg < 500),
  target_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE weight_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_weight_records" ON weight_records;
CREATE POLICY "users_select_own_weight_records" ON weight_records
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_weight_records" ON weight_records;
CREATE POLICY "users_insert_own_weight_records" ON weight_records
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_weight_records" ON weight_records;
CREATE POLICY "users_update_own_weight_records" ON weight_records
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_weight_records" ON weight_records;
CREATE POLICY "users_delete_own_weight_records" ON weight_records
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_select_own_weight_goals" ON weight_goals;
CREATE POLICY "users_select_own_weight_goals" ON weight_goals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_weight_goals" ON weight_goals;
CREATE POLICY "users_insert_own_weight_goals" ON weight_goals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_weight_goals" ON weight_goals;
CREATE POLICY "users_update_own_weight_goals" ON weight_goals
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_weight_goals" ON weight_goals;
CREATE POLICY "users_delete_own_weight_goals" ON weight_goals
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 젤리 지급 사유 확장 (몸무게 기록)
ALTER TABLE jelly_rewards_log DROP CONSTRAINT IF EXISTS jelly_rewards_log_reason_check;
ALTER TABLE jelly_rewards_log ADD CONSTRAINT jelly_rewards_log_reason_check
  CHECK (reason IN ('task_complete', 'diary_write', 'weight_record', 'weight_goal_reached'));

CREATE OR REPLACE FUNCTION award_jelly(
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
    RAISE EXCEPTION '지급 젤리는 1 이상이어야 합니다.';
  END IF;

  IF p_reason NOT IN ('task_complete', 'diary_write', 'weight_record', 'weight_goal_reached') THEN
    RAISE EXCEPTION '유효하지 않은 지급 사유입니다.';
  END IF;

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key가 필요합니다.';
  END IF;

  INSERT INTO user_jelly (user_id, balance)
  VALUES (v_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO jelly_rewards_log (user_id, amount, reason, idempotency_key)
  VALUES (v_user_id, p_amount, p_reason, trim(p_idempotency_key))
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING true INTO v_inserted;

  IF NOT COALESCE(v_inserted, false) THEN
    SELECT balance INTO v_balance FROM user_jelly WHERE user_id = v_user_id;
    RETURN json_build_object(
      'balance', COALESCE(v_balance, 0),
      'awarded', 0,
      'alreadyAwarded', true
    );
  END IF;

  UPDATE user_jelly
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_balance;

  RETURN json_build_object(
    'balance', v_balance,
    'awarded', p_amount,
    'alreadyAwarded', false
  );
END;
$$;

-- 기존 DB에 몸무게 메뉴 권한 추가
UPDATE role_menu_permissions
SET allowed_menu_ids = array_append(allowed_menu_ids, 'weight-tracking')
WHERE NOT ('weight-tracking' = ANY(allowed_menu_ids));

COMMENT ON TABLE weight_records IS '사용자 몸무게 일별 기록';
COMMENT ON TABLE weight_goals IS '사용자 목표 몸무게';
