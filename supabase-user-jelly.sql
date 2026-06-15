-- 사용자 젤리 (포실이 키우기용, AI 토큰과 별도)

CREATE TABLE IF NOT EXISTS user_jelly (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jelly_rewards_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (reason IN ('task_complete', 'diary_write')),
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_jelly_rewards_log_user_id ON jelly_rewards_log (user_id);

ALTER TABLE user_jelly ENABLE ROW LEVEL SECURITY;
ALTER TABLE jelly_rewards_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_jelly" ON user_jelly;
CREATE POLICY "users_read_own_jelly" ON user_jelly
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_read_own_jelly_log" ON jelly_rewards_log;
CREATE POLICY "users_read_own_jelly_log" ON jelly_rewards_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_read_all_jelly" ON user_jelly;
CREATE POLICY "admins_read_all_jelly" ON user_jelly
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- 본인 젤리 잔액 조회
CREATE OR REPLACE FUNCTION get_my_jelly_balance()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  INSERT INTO user_jelly (user_id, balance)
  VALUES (v_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM user_jelly
  WHERE user_id = v_user_id;

  RETURN COALESCE(v_balance, 0);
END;
$$;

-- 젤리 지급 (중복 지급 방지)
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

  IF p_reason NOT IN ('task_complete', 'diary_write') THEN
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

GRANT EXECUTE ON FUNCTION get_my_jelly_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION award_jelly(INTEGER, TEXT, TEXT) TO authenticated;

COMMENT ON TABLE user_jelly IS '사용자 젤리 잔액 (포실이 키우기용)';
COMMENT ON TABLE jelly_rewards_log IS '젤리 지급 이력 (중복 방지)';
