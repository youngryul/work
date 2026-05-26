-- AI 일기 이미지 생성 토큰
-- 기본 10 토큰, 생성 1회당 3 토큰 소모 (관리자 화면에서 조절 가능)

CREATE TABLE IF NOT EXISTS ai_token_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_balance INTEGER NOT NULL DEFAULT 10 CHECK (default_balance >= 0),
  generation_cost INTEGER NOT NULL DEFAULT 3 CHECK (generation_cost > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ai_token_settings (id, default_balance, generation_cost)
VALUES (1, 10, 3)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_ai_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 10 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_ai_tokens_balance ON user_ai_tokens (balance);

ALTER TABLE ai_token_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ai_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_ai_token_settings" ON ai_token_settings;
CREATE POLICY "authenticated_read_ai_token_settings" ON ai_token_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admins_update_ai_token_settings" ON ai_token_settings;
CREATE POLICY "admins_update_ai_token_settings" ON ai_token_settings
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "users_read_own_ai_tokens" ON user_ai_tokens;
CREATE POLICY "users_read_own_ai_tokens" ON user_ai_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins_read_all_ai_tokens" ON user_ai_tokens;
CREATE POLICY "admins_read_all_ai_tokens" ON user_ai_tokens
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins_update_all_ai_tokens" ON user_ai_tokens;
CREATE POLICY "admins_update_all_ai_tokens" ON user_ai_tokens
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins_insert_ai_tokens" ON user_ai_tokens;
CREATE POLICY "admins_insert_ai_tokens" ON user_ai_tokens
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

-- 본인 토큰 조회 (없으면 기본값으로 생성)
CREATE OR REPLACE FUNCTION get_my_ai_token_info()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance INTEGER;
  v_default INTEGER;
  v_cost INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT default_balance, generation_cost
  INTO v_default, v_cost
  FROM ai_token_settings
  WHERE id = 1;

  v_default := COALESCE(v_default, 10);
  v_cost := COALESCE(v_cost, 3);

  INSERT INTO user_ai_tokens (user_id, balance)
  VALUES (v_user_id, v_default)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM user_ai_tokens
  WHERE user_id = v_user_id;

  RETURN json_build_object(
    'balance', COALESCE(v_balance, v_default),
    'generationCost', v_cost,
    'defaultBalance', v_default
  );
END;
$$;

-- 이미지 생성 성공 후 토큰 차감
CREATE OR REPLACE FUNCTION consume_ai_tokens(p_amount INTEGER DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance INTEGER;
  v_cost INTEGER;
  v_amount INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT generation_cost INTO v_cost FROM ai_token_settings WHERE id = 1;
  v_amount := COALESCE(NULLIF(p_amount, 0), v_cost, 3);

  PERFORM get_my_ai_token_info();

  SELECT balance INTO v_balance
  FROM user_ai_tokens
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_amount THEN
    RAISE EXCEPTION 'AI 이미지 생성 토큰이 부족합니다. (보유: %, 필요: %)',
      COALESCE(v_balance, 0), v_amount;
  END IF;

  UPDATE user_ai_tokens
  SET balance = balance - v_amount,
      updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_balance;

  RETURN v_balance;
END;
$$;

-- 관리자: 유저 토큰 잔액 설정
CREATE OR REPLACE FUNCTION admin_set_user_ai_token_balance(
  p_user_id UUID,
  p_balance INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default INTEGER;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION '대상 사용자를 확인해주세요.';
  END IF;

  IF p_balance IS NULL OR p_balance < 0 THEN
    RAISE EXCEPTION '토큰은 0 이상이어야 합니다.';
  END IF;

  SELECT default_balance INTO v_default FROM ai_token_settings WHERE id = 1;
  v_default := COALESCE(v_default, 10);

  INSERT INTO user_ai_tokens (user_id, balance)
  VALUES (p_user_id, p_balance)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = EXCLUDED.balance,
      updated_at = NOW();

  RETURN p_balance;
END;
$$;

-- 관리자: 전역 설정 변경
CREATE OR REPLACE FUNCTION admin_update_ai_token_settings(
  p_default_balance INTEGER,
  p_generation_cost INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  IF p_default_balance IS NULL OR p_default_balance < 0 THEN
    RAISE EXCEPTION '기본 토큰은 0 이상이어야 합니다.';
  END IF;

  IF p_generation_cost IS NULL OR p_generation_cost <= 0 THEN
    RAISE EXCEPTION '생성 비용은 1 이상이어야 합니다.';
  END IF;

  UPDATE ai_token_settings
  SET default_balance = p_default_balance,
      generation_cost = p_generation_cost,
      updated_at = NOW()
  WHERE id = 1;

  IF NOT FOUND THEN
    INSERT INTO ai_token_settings (id, default_balance, generation_cost)
    VALUES (1, p_default_balance, p_generation_cost);
  END IF;

  RETURN json_build_object(
    'defaultBalance', p_default_balance,
    'generationCost', p_generation_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_ai_token_info() TO authenticated;
GRANT EXECUTE ON FUNCTION consume_ai_tokens(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_ai_token_balance(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_ai_token_settings(INTEGER, INTEGER) TO authenticated;
