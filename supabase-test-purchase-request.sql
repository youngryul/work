-- 테스트용 충전 신청 데이터 1건 생성 (젤리)
-- 사용 방법:
-- 1) 아래 target_email 값을 실제 테스트 계정 이메일로 변경
-- 2) Supabase SQL Editor에서 실행

DO $$
DECLARE
  v_target_email TEXT := 'test@example.com'; -- TODO: 실제 테스트 계정 이메일로 변경
  v_user_id UUID;
BEGIN
  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_target_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '테스트 계정을 찾을 수 없습니다. target_email 값을 확인해주세요.';
  END IF;

  INSERT INTO ai_token_purchase_requests (
    user_id,
    user_email,
    depositor_name,
    deposit_amount_krw,
    purchase_type,
    requested_tokens,
    requested_jelly,
    status
  ) VALUES (
    v_user_id,
    v_target_email,
    '테스트입금자',
    5000,
    'jelly',
    NULL,
    50,
    'pending'
  );
END $$;

