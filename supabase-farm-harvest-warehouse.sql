-- 농장 수확 · 창고 · 캐릭터 작물 요청 · 젤리 보상

-- 젤리 사유 추가
ALTER TABLE jelly_rewards_log DROP CONSTRAINT IF EXISTS jelly_rewards_log_reason_check;
ALTER TABLE jelly_rewards_log ADD CONSTRAINT jelly_rewards_log_reason_check
  CHECK (reason IN (
    'task_complete',
    'diary_write',
    'weight_record',
    'weight_goal_reached',
    'farm_refund',
    'five_year_answer',
    'habit_tracker_first_today',
    'recipe_create',
    'step_milestone',
    'farm_crop_request'
  ));

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

  IF p_reason NOT IN (
    'task_complete',
    'diary_write',
    'weight_record',
    'weight_goal_reached',
    'farm_refund',
    'five_year_answer',
    'habit_tracker_first_today',
    'recipe_create',
    'step_milestone',
    'farm_crop_request'
  ) THEN
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

-- 창고 재고 (작물 종류별 수량)
CREATE TABLE IF NOT EXISTS farm_warehouse_stock (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  crop_gacha_character_id UUID NOT NULL REFERENCES gacha_characters(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, crop_gacha_character_id)
);

CREATE INDEX IF NOT EXISTS idx_farm_warehouse_stock_user
  ON farm_warehouse_stock (user_id);

ALTER TABLE farm_warehouse_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_farm_warehouse" ON farm_warehouse_stock;
CREATE POLICY "users_select_own_farm_warehouse" ON farm_warehouse_stock
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 캐릭터 작물 요청 (진행 중 1건)
CREATE TABLE IF NOT EXISTS farm_crop_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_character_id UUID NOT NULL REFERENCES gacha_characters(id) ON DELETE CASCADE,
  crop_gacha_character_id UUID NOT NULL REFERENCES gacha_characters(id) ON DELETE CASCADE,
  max_quantity INTEGER NOT NULL CHECK (max_quantity > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_farm_crop_requests_user_pending
  ON farm_crop_requests (user_id, status)
  WHERE status = 'pending';

ALTER TABLE farm_crop_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_farm_crop_requests" ON farm_crop_requests;
CREATE POLICY "users_select_own_farm_crop_requests" ON farm_crop_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

INSERT INTO farm_settings (key, value, label) VALUES
  ('crop_request_max_quantity', '5', '캐릭터 요청 최대 작물 수'),
  ('crop_request_jelly_min_base', '2', '작물 요청 젤리 기본 최소'),
  ('crop_request_jelly_max_base', '5', '작물 요청 젤리 기본 최대'),
  ('crop_request_jelly_min_per_crop', '1', '작물 1개당 젤리 최소'),
  ('crop_request_jelly_max_per_crop', '4', '작물 1개당 젤리 최대')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION get_farm_setting_int(p_key TEXT, p_default INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_val INTEGER;
BEGIN
  SELECT COALESCE(value::INTEGER, p_default) INTO v_val
  FROM farm_settings
  WHERE key = p_key;
  RETURN COALESCE(v_val, p_default);
END;
$$;

CREATE OR REPLACE FUNCTION farm_warehouse_add_crop(
  p_user_id UUID,
  p_crop_gacha_id UUID,
  p_amount INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO farm_warehouse_stock (user_id, crop_gacha_character_id, quantity)
  VALUES (p_user_id, p_crop_gacha_id, p_amount)
  ON CONFLICT (user_id, crop_gacha_character_id)
  DO UPDATE SET
    quantity = farm_warehouse_stock.quantity + EXCLUDED.quantity,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION farm_warehouse_deduct_crop(
  p_user_id UUID,
  p_crop_gacha_id UUID,
  p_amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty INTEGER;
BEGIN
  SELECT quantity INTO v_qty
  FROM farm_warehouse_stock
  WHERE user_id = p_user_id AND crop_gacha_character_id = p_crop_gacha_id
  FOR UPDATE;

  IF NOT FOUND OR v_qty < p_amount THEN
    RETURN false;
  END IF;

  IF v_qty = p_amount THEN
    DELETE FROM farm_warehouse_stock
    WHERE user_id = p_user_id AND crop_gacha_character_id = p_crop_gacha_id;
  ELSE
    UPDATE farm_warehouse_stock
    SET quantity = quantity - p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id AND crop_gacha_character_id = p_crop_gacha_id;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION build_farm_warehouse_json(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'cropGachaCharacterId', w.crop_gacha_character_id,
        'cropName', c.name,
        'cropImageUrl', c.image_url,
        'quantity', w.quantity
      )
      ORDER BY c.name
    ),
    '[]'::json
  )
  INTO v_result
  FROM farm_warehouse_stock w
  JOIN gacha_characters c ON c.id = w.crop_gacha_character_id
  WHERE w.user_id = p_user_id AND w.quantity > 0;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION build_farm_crop_request_json(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_req farm_crop_requests%ROWTYPE;
  v_requester_name TEXT;
  v_requester_image TEXT;
  v_crop_name TEXT;
  v_crop_image TEXT;
  v_stock INTEGER := 0;
BEGIN
  SELECT * INTO v_req FROM farm_crop_requests WHERE id = p_request_id;
  IF NOT FOUND OR v_req.status <> 'pending' THEN
    RETURN NULL;
  END IF;

  SELECT name, image_url INTO v_requester_name, v_requester_image
  FROM gacha_characters WHERE id = v_req.requester_character_id;

  SELECT name, image_url INTO v_crop_name, v_crop_image
  FROM gacha_characters WHERE id = v_req.crop_gacha_character_id;

  SELECT COALESCE(quantity, 0) INTO v_stock
  FROM farm_warehouse_stock
  WHERE user_id = v_req.user_id AND crop_gacha_character_id = v_req.crop_gacha_character_id;

  RETURN json_build_object(
    'id', v_req.id,
    'requesterCharacterId', v_req.requester_character_id,
    'requesterName', v_requester_name,
    'requesterImageUrl', v_requester_image,
    'cropGachaCharacterId', v_req.crop_gacha_character_id,
    'cropName', v_crop_name,
    'cropImageUrl', v_crop_image,
    'maxQuantity', v_req.max_quantity,
    'warehouseQuantity', v_stock
  );
END;
$$;

CREATE OR REPLACE FUNCTION try_spawn_farm_crop_request(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing UUID;
  v_requester_id UUID;
  v_crop_id UUID;
  v_stock INTEGER;
  v_max_req INTEGER;
  v_qty INTEGER;
  v_request_id UUID;
  v_total_weight BIGINT;
  v_roll BIGINT;
  v_running BIGINT;
  v_row RECORD;
BEGIN
  SELECT id INTO v_existing
  FROM farm_crop_requests
  WHERE user_id = p_user_id AND status = 'pending'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_stock
  FROM farm_warehouse_stock
  WHERE user_id = p_user_id AND quantity > 0;

  IF COALESCE(v_stock, 0) <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_requester_id
  FROM gacha_characters
  WHERE is_active = true AND COALESCE(is_crop, false) = false
  ORDER BY random()
  LIMIT 1;

  IF v_requester_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_max_req := get_farm_setting_int('crop_request_max_quantity', 5);

  SELECT COALESCE(SUM(quantity), 0) INTO v_total_weight
  FROM farm_warehouse_stock
  WHERE user_id = p_user_id AND quantity > 0;

  v_roll := floor(random() * GREATEST(v_total_weight, 1))::BIGINT;
  v_running := 0;
  v_crop_id := NULL;

  FOR v_row IN
    SELECT crop_gacha_character_id AS cid, quantity AS qty
    FROM farm_warehouse_stock
    WHERE user_id = p_user_id AND quantity > 0
    ORDER BY crop_gacha_character_id
  LOOP
    v_running := v_running + v_row.qty;
    IF v_roll < v_running THEN
      v_crop_id := v_row.cid;
      v_stock := v_row.qty;
      EXIT;
    END IF;
  END LOOP;

  IF v_crop_id IS NULL THEN
    SELECT crop_gacha_character_id, quantity INTO v_crop_id, v_stock
    FROM farm_warehouse_stock
    WHERE user_id = p_user_id AND quantity > 0
    ORDER BY random()
    LIMIT 1;
  END IF;

  IF v_crop_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_qty := 1 + floor(random() * LEAST(v_max_req, v_stock))::INTEGER;
  v_qty := GREATEST(1, LEAST(v_qty, v_stock, v_max_req));

  INSERT INTO farm_crop_requests (
    user_id,
    requester_character_id,
    crop_gacha_character_id,
    max_quantity,
    status
  )
  VALUES (p_user_id, v_requester_id, v_crop_id, v_qty, 'pending')
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION calc_farm_crop_request_jelly(p_quantity INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_min_base INTEGER;
  v_max_base INTEGER;
  v_min_per INTEGER;
  v_max_per INTEGER;
  v_base INTEGER;
  v_per INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN 0;
  END IF;

  v_min_base := get_farm_setting_int('crop_request_jelly_min_base', 2);
  v_max_base := get_farm_setting_int('crop_request_jelly_max_base', 5);
  v_min_per := get_farm_setting_int('crop_request_jelly_min_per_crop', 1);
  v_max_per := get_farm_setting_int('crop_request_jelly_max_per_crop', 4);

  IF v_max_base < v_min_base THEN
    v_max_base := v_min_base;
  END IF;
  IF v_max_per < v_min_per THEN
    v_max_per := v_min_per;
  END IF;

  v_base := v_min_base + floor(random() * (v_max_base - v_min_base + 1))::INTEGER;
  v_per := v_min_per + floor(random() * (v_max_per - v_min_per + 1))::INTEGER;

  RETURN v_base + (p_quantity * v_per);
END;
$$;

CREATE OR REPLACE FUNCTION get_farm_warehouse_state()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_id UUID;
  v_active JSON;
  v_total INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  v_request_id := try_spawn_farm_crop_request(v_user_id);

  IF v_request_id IS NOT NULL THEN
    v_active := build_farm_crop_request_json(v_request_id);
  ELSE
    SELECT build_farm_crop_request_json(r.id) INTO v_active
    FROM farm_crop_requests r
    WHERE r.user_id = v_user_id AND r.status = 'pending'
    ORDER BY r.created_at DESC
    LIMIT 1;
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_total
  FROM farm_warehouse_stock
  WHERE user_id = v_user_id;

  RETURN json_build_object(
    'warehouse', build_farm_warehouse_json(v_user_id),
    'activeRequest', v_active,
    'totalWarehouseCount', v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_my_farm_field()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_seed_count INTEGER := 0;
  v_water_xp INTEGER := 15;
  v_water_jelly INTEGER := 10;
  v_crops JSON;
  v_crop_id UUID;
  v_crop_total INTEGER := 0;
  v_crop_mature INTEGER := 0;
  v_can_harvest BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  FOR v_crop_id IN
    SELECT id FROM farm_field_crops
    WHERE user_id = v_user_id AND stage >= 4 AND crop_gacha_character_id IS NULL
  LOOP
    PERFORM assign_crop_gacha_if_needed(v_crop_id);
  END LOOP;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE stage >= 4)
  INTO v_crop_total, v_crop_mature
  FROM farm_field_crops
  WHERE user_id = v_user_id;

  v_can_harvest := v_crop_total > 0 AND v_crop_total = v_crop_mature;

  SELECT COALESCE(seed_count, 0) INTO v_seed_count
  FROM user_farm_inventory
  WHERE user_id = v_user_id;

  SELECT COALESCE(value::INTEGER, 15) INTO v_water_xp
  FROM farm_settings WHERE key = 'crop_water_xp_amount';

  SELECT COALESCE(value::INTEGER, 10) INTO v_water_jelly
  FROM farm_settings WHERE key = 'crop_water_jelly_cost';

  SELECT COALESCE(json_agg(build_farm_crop_json(c.id) ORDER BY c.cell_row, c.cell_col), '[]'::json)
  INTO v_crops
  FROM farm_field_crops c
  WHERE c.user_id = v_user_id;

  RETURN json_build_object(
    'seedCount', v_seed_count,
    'crops', v_crops,
    'waterXpAmount', v_water_xp,
    'waterJellyCost', v_water_jelly,
    'gridCols', 5,
    'gridRows', 4,
    'maxCropStage', 4,
    'canHarvest', v_can_harvest,
    'fieldCropCount', v_crop_total,
    'matureCropCount', v_crop_mature
  );
END;
$$;

CREATE OR REPLACE FUNCTION harvest_farm_field()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_crop RECORD;
  v_crop_total INTEGER := 0;
  v_crop_mature INTEGER := 0;
  v_harvested JSON;
  v_gacha_id UUID;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE stage >= 4)
  INTO v_crop_total, v_crop_mature
  FROM farm_field_crops
  WHERE user_id = v_user_id;

  IF v_crop_mature = 0 THEN
    RAISE EXCEPTION '수확할 완성 작물이 없어요.';
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
    'cropGachaCharacterId', c.crop_gacha_character_id,
    'cropName', g.name,
    'cropImageUrl', g.image_url,
    'quantity', 1
  )), '[]'::json)
  INTO v_harvested
  FROM farm_field_crops c
  LEFT JOIN gacha_characters g ON g.id = c.crop_gacha_character_id
  WHERE c.user_id = v_user_id AND c.stage >= 4;

  FOR v_crop IN
    SELECT id, crop_gacha_character_id
    FROM farm_field_crops
    WHERE user_id = v_user_id AND stage >= 4
    FOR UPDATE
  LOOP
    PERFORM assign_crop_gacha_if_needed(v_crop.id);

    SELECT crop_gacha_character_id INTO v_gacha_id
    FROM farm_field_crops
    WHERE id = v_crop.id;

    IF v_gacha_id IS NOT NULL THEN
      PERFORM farm_warehouse_add_crop(v_user_id, v_gacha_id, 1);
    END IF;
  END LOOP;

  DELETE FROM farm_field_crops WHERE user_id = v_user_id AND stage >= 4;

  v_request_id := try_spawn_farm_crop_request(v_user_id);

  RETURN json_build_object(
    'harvested', v_harvested,
    'harvestedCount', v_crop_mature,
    'warehouse', build_farm_warehouse_json(v_user_id),
    'activeRequest', CASE
      WHEN v_request_id IS NOT NULL THEN build_farm_crop_request_json(v_request_id)
      ELSE NULL
    END
  );
END;
$$;

CREATE OR REPLACE FUNCTION fulfill_farm_crop_request(
  p_request_id UUID,
  p_give_quantity INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_req farm_crop_requests%ROWTYPE;
  v_stock INTEGER;
  v_jelly INTEGER;
  v_award JSON;
  v_awarded INTEGER := 0;
  v_balance INTEGER := 0;
  v_next_request UUID;
  v_next_json JSON;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION '요청을 찾을 수 없어요.';
  END IF;

  IF p_give_quantity IS NULL OR p_give_quantity <= 0 THEN
    RAISE EXCEPTION '줄 작물 수는 1 이상이어야 해요.';
  END IF;

  SELECT * INTO v_req
  FROM farm_crop_requests
  WHERE id = p_request_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '요청을 찾을 수 없어요.';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION '이미 처리된 요청이에요.';
  END IF;

  IF p_give_quantity > v_req.max_quantity THEN
    RAISE EXCEPTION '요청 수량보다 많이 줄 수 없어요.';
  END IF;

  SELECT COALESCE(quantity, 0) INTO v_stock
  FROM farm_warehouse_stock
  WHERE user_id = v_user_id AND crop_gacha_character_id = v_req.crop_gacha_character_id;

  IF v_stock < p_give_quantity THEN
    RAISE EXCEPTION '창고에 작물이 부족해요.';
  END IF;

  IF NOT farm_warehouse_deduct_crop(v_user_id, v_req.crop_gacha_character_id, p_give_quantity) THEN
    RAISE EXCEPTION '창고에서 작물을 꺼내지 못했어요.';
  END IF;

  v_jelly := calc_farm_crop_request_jelly(p_give_quantity);

  v_award := award_jelly(
    v_jelly,
    'farm_crop_request',
    'farm_crop_req:' || p_request_id::text
  );

  v_awarded := COALESCE((v_award->>'awarded')::INTEGER, 0);
  v_balance := COALESCE((v_award->>'balance')::INTEGER, 0);

  UPDATE farm_crop_requests
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = p_request_id;

  v_next_request := try_spawn_farm_crop_request(v_user_id);
  IF v_next_request IS NOT NULL THEN
    v_next_json := build_farm_crop_request_json(v_next_request);
  ELSE
    v_next_json := NULL;
  END IF;

  RETURN json_build_object(
    'jellyAwarded', v_awarded,
    'jellyBalance', v_balance,
    'giveQuantity', p_give_quantity,
    'warehouse', build_farm_warehouse_json(v_user_id),
    'activeRequest', v_next_json
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_farm_warehouse_state() TO authenticated;
GRANT EXECUTE ON FUNCTION harvest_farm_field() TO authenticated;
GRANT EXECUTE ON FUNCTION fulfill_farm_crop_request(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_farm_field() TO authenticated;

COMMENT ON TABLE farm_warehouse_stock IS '농장 수확 작물 창고';
COMMENT ON TABLE farm_crop_requests IS '캐릭터 작물 요청 이벤트';
