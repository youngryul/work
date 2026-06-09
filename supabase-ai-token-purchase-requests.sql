-- AI 토큰 무통장 충전 신청 (관리자 확인용)
-- is_admin() 함수는 기존 admin_users / 관리자 RPC 환경에서 사용

CREATE TABLE IF NOT EXISTS ai_token_purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  depositor_name TEXT NOT NULL,
  deposit_amount_krw INTEGER NOT NULL CHECK (deposit_amount_krw > 0),
  requested_tokens INTEGER NOT NULL CHECK (requested_tokens > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_token_purchase_requests_user_id
  ON ai_token_purchase_requests (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_token_purchase_requests_status
  ON ai_token_purchase_requests (status);

CREATE INDEX IF NOT EXISTS idx_ai_token_purchase_requests_created_at
  ON ai_token_purchase_requests (created_at DESC);

ALTER TABLE ai_token_purchase_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_insert_own_token_purchase_requests" ON ai_token_purchase_requests;
CREATE POLICY "users_insert_own_token_purchase_requests" ON ai_token_purchase_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_read_own_token_purchase_requests" ON ai_token_purchase_requests;
CREATE POLICY "users_read_own_token_purchase_requests" ON ai_token_purchase_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "superuser_read_all_token_purchase_requests" ON ai_token_purchase_requests;
DROP POLICY IF EXISTS "admin_read_all_token_purchase_requests" ON ai_token_purchase_requests;
CREATE POLICY "admin_read_all_token_purchase_requests" ON ai_token_purchase_requests
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "superuser_update_token_purchase_requests" ON ai_token_purchase_requests;
DROP POLICY IF EXISTS "admin_update_token_purchase_requests" ON ai_token_purchase_requests;
CREATE POLICY "admin_update_token_purchase_requests" ON ai_token_purchase_requests
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

COMMENT ON TABLE ai_token_purchase_requests IS 'AI 토큰 무통장 충전 신청 (관리자 확인용)';

-- 관리자: 완료 처리 시 이메일로 사용자를 찾아 신청 토큰을 잔액에 추가
CREATE OR REPLACE FUNCTION admin_complete_token_purchase_request(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request ai_token_purchase_requests%ROWTYPE;
  v_target_user_id UUID;
  v_default INTEGER;
  v_new_balance INTEGER;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  SELECT * INTO v_request
  FROM ai_token_purchase_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '충전 신청을 찾을 수 없습니다.';
  END IF;

  IF v_request.status = 'completed' THEN
    RAISE EXCEPTION '이미 완료 처리된 신청입니다.';
  END IF;

  IF v_request.status = 'rejected' THEN
    RAISE EXCEPTION '반려된 신청은 완료 처리할 수 없습니다.';
  END IF;

  -- 신청 이메일로 사용자 조회 (없으면 신청 시 user_id 사용)
  IF v_request.user_email IS NOT NULL AND trim(v_request.user_email) <> '' THEN
    SELECT id INTO v_target_user_id
    FROM auth.users
    WHERE lower(email) = lower(trim(v_request.user_email))
    LIMIT 1;
  END IF;

  IF v_target_user_id IS NULL THEN
    v_target_user_id := v_request.user_id;
  END IF;

  IF v_target_user_id IS NULL THEN
    RAISE EXCEPTION '이메일로 사용자를 찾을 수 없습니다.';
  END IF;

  SELECT default_balance INTO v_default FROM ai_token_settings WHERE id = 1;
  v_default := COALESCE(v_default, 10);

  INSERT INTO user_ai_tokens (user_id, balance)
  VALUES (v_target_user_id, v_default)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE user_ai_tokens
  SET balance = balance + v_request.requested_tokens,
      updated_at = NOW()
  WHERE user_id = v_target_user_id
  RETURNING balance INTO v_new_balance;

  UPDATE ai_token_purchase_requests
  SET status = 'completed',
      updated_at = NOW()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'requestId', p_request_id,
    'userId', v_target_user_id,
    'email', v_request.user_email,
    'addedTokens', v_request.requested_tokens,
    'newBalance', v_new_balance,
    'status', 'completed'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_complete_token_purchase_request(UUID) TO authenticated;
