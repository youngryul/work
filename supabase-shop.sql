-- 상점: 씨앗(젤리 구매), 젤리·토큰 무통장 충전 신청 확장

-- 씨앗 1개당 젤리 가격 (farm_settings)
INSERT INTO farm_settings (key, value, label)
VALUES ('shop_seed_jelly_cost', '10', '상점 씨앗 1개 젤리 가격')
ON CONFLICT (key) DO NOTHING;

-- 충전 신청: 젤리 유형 추가
ALTER TABLE ai_token_purchase_requests
  ADD COLUMN IF NOT EXISTS purchase_type TEXT NOT NULL DEFAULT 'ai_token';

ALTER TABLE ai_token_purchase_requests
  ADD COLUMN IF NOT EXISTS requested_jelly INTEGER;

ALTER TABLE ai_token_purchase_requests
  ALTER COLUMN requested_tokens DROP NOT NULL;

ALTER TABLE ai_token_purchase_requests DROP CONSTRAINT IF EXISTS ai_token_purchase_requests_purchase_type_check;
ALTER TABLE ai_token_purchase_requests ADD CONSTRAINT ai_token_purchase_requests_purchase_type_check
  CHECK (purchase_type IN ('ai_token', 'jelly'));

ALTER TABLE ai_token_purchase_requests DROP CONSTRAINT IF EXISTS ai_token_purchase_requests_product_check;
ALTER TABLE ai_token_purchase_requests ADD CONSTRAINT ai_token_purchase_requests_product_check
  CHECK (
    (
      purchase_type = 'ai_token'
      AND requested_tokens IS NOT NULL
      AND requested_tokens > 0
      AND (requested_jelly IS NULL OR requested_jelly = 0)
    )
    OR (
      purchase_type = 'jelly'
      AND requested_jelly IS NOT NULL
      AND requested_jelly > 0
      AND (requested_tokens IS NULL OR requested_tokens = 0)
    )
  );

CREATE INDEX IF NOT EXISTS idx_ai_token_purchase_requests_purchase_type
  ON ai_token_purchase_requests (purchase_type);

COMMENT ON COLUMN ai_token_purchase_requests.purchase_type IS '충전 유형: ai_token | jelly';
COMMENT ON COLUMN ai_token_purchase_requests.requested_jelly IS '젤리 충전 신청 수량';

-- 상점 씨앗 젤리 단가 조회
CREATE OR REPLACE FUNCTION get_shop_seed_jelly_cost()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cost INTEGER;
BEGIN
  SELECT value::INTEGER INTO v_cost
  FROM farm_settings
  WHERE key = 'shop_seed_jelly_cost';

  RETURN COALESCE(NULLIF(v_cost, 0), 10);
END;
$$;

-- 젤리로 씨앗 구매
CREATE OR REPLACE FUNCTION purchase_farm_seeds_with_jelly(p_quantity INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_cost_per_seed INTEGER;
  v_total_jelly INTEGER;
  v_spend_key TEXT;
  v_spend_result JSON;
  v_seed_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 99 THEN
    RAISE EXCEPTION '구매 수량은 1~99개 사이여야 합니다.';
  END IF;

  v_cost_per_seed := get_shop_seed_jelly_cost();
  v_total_jelly := v_cost_per_seed * p_quantity;
  v_spend_key := 'shop_seed:' || gen_random_uuid()::TEXT;

  v_spend_result := spend_jelly(v_total_jelly, 'shop_seed', v_spend_key);

  IF COALESCE((v_spend_result->>'spent')::INTEGER, 0) <= 0
     AND COALESCE((v_spend_result->>'alreadySpent')::BOOLEAN, false) = false THEN
    RAISE EXCEPTION '젤리 차감에 실패했습니다.';
  END IF;

  INSERT INTO user_farm_inventory (user_id, seed_count, welcome_seed_granted)
  VALUES (v_user_id, 0, false)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE user_farm_inventory
  SET seed_count = seed_count + p_quantity,
      updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING seed_count INTO v_seed_count;

  RETURN json_build_object(
    'seedCount', COALESCE(v_seed_count, 0),
    'purchased', p_quantity,
    'jellySpent', v_total_jelly,
    'jellyBalance', COALESCE((v_spend_result->>'balance')::INTEGER, 0),
    'costPerSeed', v_cost_per_seed
  );
END;
$$;

-- 관리자: 유저 젤리 잔액 설정
CREATE OR REPLACE FUNCTION admin_set_user_jelly_balance(
  p_user_id UUID,
  p_balance INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION '대상 사용자를 확인해주세요.';
  END IF;

  IF p_balance IS NULL OR p_balance < 0 THEN
    RAISE EXCEPTION '젤리는 0 이상이어야 합니다.';
  END IF;

  INSERT INTO user_jelly (user_id, balance)
  VALUES (p_user_id, p_balance)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = EXCLUDED.balance,
      updated_at = NOW();

  RETURN p_balance;
END;
$$;

-- 관리자: 충전 완료 (토큰·젤리)
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

  IF COALESCE(v_request.purchase_type, 'ai_token') = 'jelly' THEN
    INSERT INTO user_jelly (user_id, balance)
    VALUES (v_target_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE user_jelly
    SET balance = balance + v_request.requested_jelly,
        updated_at = NOW()
    WHERE user_id = v_target_user_id
    RETURNING balance INTO v_new_balance;

    UPDATE ai_token_purchase_requests
    SET status = 'completed',
        updated_at = NOW()
    WHERE id = p_request_id;

    RETURN json_build_object(
      'requestId', p_request_id,
      'purchaseType', 'jelly',
      'userId', v_target_user_id,
      'email', v_request.user_email,
      'addedJelly', v_request.requested_jelly,
      'newBalance', v_new_balance,
      'status', 'completed'
    );
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
    'purchaseType', 'ai_token',
    'userId', v_target_user_id,
    'email', v_request.user_email,
    'addedTokens', v_request.requested_tokens,
    'newBalance', v_new_balance,
    'status', 'completed'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_shop_seed_jelly_cost() TO authenticated;
GRANT EXECUTE ON FUNCTION purchase_farm_seeds_with_jelly(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_jelly_balance(UUID, INTEGER) TO authenticated;
