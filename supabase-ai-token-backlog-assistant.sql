-- 백로그 AI 어시스턴트 토큰 비용 설정

ALTER TABLE ai_token_settings
  ADD COLUMN IF NOT EXISTS backlog_assistant_cost INTEGER NOT NULL DEFAULT 1
  CHECK (backlog_assistant_cost > 0);

UPDATE ai_token_settings
SET backlog_assistant_cost = 1
WHERE id = 1 AND backlog_assistant_cost IS NULL;

-- 본인 토큰 조회 (백로그 어시스턴트 비용 포함)
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
  v_backlog_cost INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT default_balance, generation_cost, backlog_assistant_cost
  INTO v_default, v_cost, v_backlog_cost
  FROM ai_token_settings
  WHERE id = 1;

  v_default := COALESCE(v_default, 10);
  v_cost := COALESCE(v_cost, 3);
  v_backlog_cost := COALESCE(v_backlog_cost, 1);

  INSERT INTO user_ai_tokens (user_id, balance)
  VALUES (v_user_id, v_default)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
  FROM user_ai_tokens
  WHERE user_id = v_user_id;

  RETURN json_build_object(
    'balance', COALESCE(v_balance, v_default),
    'generationCost', v_cost,
    'backlogAssistantCost', v_backlog_cost,
    'defaultBalance', v_default
  );
END;
$$;

-- 토큰 차감 (이미지·백로그 어시스턴트 등 공통)
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
    RAISE EXCEPTION 'AI 토큰이 부족합니다. (보유: %, 필요: %)',
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

-- 관리자: 전역 설정 변경 (백로그 어시스턴트 비용 포함)
CREATE OR REPLACE FUNCTION admin_update_ai_token_settings(
  p_default_balance INTEGER,
  p_generation_cost INTEGER,
  p_backlog_assistant_cost INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_backlog_cost INTEGER;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  IF p_default_balance IS NULL OR p_default_balance < 0 THEN
    RAISE EXCEPTION '기본 토큰은 0 이상이어야 합니다.';
  END IF;

  IF p_generation_cost IS NULL OR p_generation_cost <= 0 THEN
    RAISE EXCEPTION '이미지 생성 비용은 1 이상이어야 합니다.';
  END IF;

  SELECT backlog_assistant_cost INTO v_backlog_cost
  FROM ai_token_settings
  WHERE id = 1;

  v_backlog_cost := COALESCE(NULLIF(p_backlog_assistant_cost, 0), v_backlog_cost, 1);

  IF v_backlog_cost IS NULL OR v_backlog_cost <= 0 THEN
    RAISE EXCEPTION '백로그 어시스턴트 비용은 1 이상이어야 합니다.';
  END IF;

  UPDATE ai_token_settings
  SET default_balance = p_default_balance,
      generation_cost = p_generation_cost,
      backlog_assistant_cost = v_backlog_cost,
      updated_at = NOW()
  WHERE id = 1;

  IF NOT FOUND THEN
    INSERT INTO ai_token_settings (id, default_balance, generation_cost, backlog_assistant_cost)
    VALUES (1, p_default_balance, p_generation_cost, v_backlog_cost);
  END IF;

  RETURN json_build_object(
    'defaultBalance', p_default_balance,
    'generationCost', p_generation_cost,
    'backlogAssistantCost', v_backlog_cost
  );
END;
$$;

COMMENT ON COLUMN ai_token_settings.backlog_assistant_cost IS '백로그 AI 어시스턴트 1회 분석 토큰 비용';
