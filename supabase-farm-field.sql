-- 농장 밭: 5×4 격자 작물 심기·물주기 (4단계 성장)

CREATE TABLE IF NOT EXISTS farm_field_crops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cell_row INTEGER NOT NULL CHECK (cell_row >= 0 AND cell_row < 4),
  cell_col INTEGER NOT NULL CHECK (cell_col >= 0 AND cell_col < 5),
  stage INTEGER NOT NULL DEFAULT 1 CHECK (stage >= 1 AND stage <= 4),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, cell_row, cell_col)
);

CREATE INDEX IF NOT EXISTS idx_farm_field_crops_user_id ON farm_field_crops (user_id);

ALTER TABLE farm_field_crops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_farm_field_crops" ON farm_field_crops;
CREATE POLICY "users_read_own_farm_field_crops" ON farm_field_crops
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 작물 성장 설정
INSERT INTO farm_settings (key, value, label) VALUES
  ('crop_stage_1_xp_required', '30', '씨앗→새싹 필요 경험치'),
  ('crop_stage_2_xp_required', '50', '새싹→꽃 필요 경험치'),
  ('crop_stage_3_xp_required', '70', '꽃→작물 필요 경험치'),
  ('crop_water_xp_amount', '15', '물주기당 성장 경험치'),
  ('crop_water_jelly_cost', '10', '물주기당 젤리 소비')
ON CONFLICT (key) DO NOTHING;

UPDATE farm_settings SET value = '10' WHERE key = 'crop_water_jelly_cost';

CREATE OR REPLACE FUNCTION get_crop_stage_xp_required(p_stage INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_threshold INTEGER;
BEGIN
  IF p_stage >= 4 THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(value::INTEGER, 30) INTO v_threshold
  FROM farm_settings
  WHERE key = 'crop_stage_' || p_stage || '_xp_required';

  RETURN COALESCE(v_threshold, 30);
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT COALESCE(seed_count, 0) INTO v_seed_count
  FROM user_farm_inventory
  WHERE user_id = v_user_id;

  SELECT COALESCE(value::INTEGER, 15) INTO v_water_xp
  FROM farm_settings WHERE key = 'crop_water_xp_amount';

  SELECT COALESCE(value::INTEGER, 10) INTO v_water_jelly
  FROM farm_settings WHERE key = 'crop_water_jelly_cost';

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', c.id,
      'row', c.cell_row,
      'col', c.cell_col,
      'stage', c.stage,
      'xp', c.xp,
      'nextStageXpRequired', get_crop_stage_xp_required(c.stage),
      'maxStage', 4
    ) ORDER BY c.cell_row, c.cell_col
  ), '[]'::json) INTO v_crops
  FROM farm_field_crops c
  WHERE c.user_id = v_user_id;

  RETURN json_build_object(
    'seedCount', v_seed_count,
    'crops', v_crops,
    'waterXpAmount', v_water_xp,
    'waterJellyCost', v_water_jelly,
    'gridCols', 5,
    'gridRows', 4,
    'maxCropStage', 4
  );
END;
$$;

CREATE OR REPLACE FUNCTION plant_farm_seed(
  p_cell_row INTEGER,
  p_cell_col INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_progress user_farm_progress%ROWTYPE;
  v_seed_count INTEGER := 0;
  v_crop farm_field_crops%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_cell_row IS NULL OR p_cell_col IS NULL
     OR p_cell_row < 0 OR p_cell_row >= 4
     OR p_cell_col < 0 OR p_cell_col >= 5 THEN
    RAISE EXCEPTION '유효하지 않은 밭 위치입니다.';
  END IF;

  SELECT * INTO v_progress FROM user_farm_progress WHERE user_id = v_user_id;
  IF NOT FOUND OR v_progress.stage < 2 THEN
    RAISE EXCEPTION '농장은 2단계부터 이용할 수 있어요.';
  END IF;

  INSERT INTO user_farm_inventory (user_id, seed_count, welcome_seed_granted)
  VALUES (v_user_id, 0, false)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT seed_count INTO v_seed_count
  FROM user_farm_inventory
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF COALESCE(v_seed_count, 0) < 1 THEN
    RAISE EXCEPTION '씨앗이 없어요.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM farm_field_crops
    WHERE user_id = v_user_id AND cell_row = p_cell_row AND cell_col = p_cell_col
  ) THEN
    RAISE EXCEPTION '이미 작물이 심어진 칸이에요.';
  END IF;

  UPDATE user_farm_inventory
  SET seed_count = seed_count - 1,
      updated_at = NOW()
  WHERE user_id = v_user_id;

  INSERT INTO farm_field_crops (user_id, cell_row, cell_col, stage, xp)
  VALUES (v_user_id, p_cell_row, p_cell_col, 1, 0)
  RETURNING * INTO v_crop;

  SELECT COALESCE(seed_count, 0) INTO v_seed_count
  FROM user_farm_inventory WHERE user_id = v_user_id;

  RETURN json_build_object(
    'crop', json_build_object(
      'id', v_crop.id,
      'row', v_crop.cell_row,
      'col', v_crop.cell_col,
      'stage', v_crop.stage,
      'xp', v_crop.xp,
      'nextStageXpRequired', get_crop_stage_xp_required(v_crop.stage),
      'maxStage', 4
    ),
    'seedCount', v_seed_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION water_farm_crop(p_crop_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_crop farm_field_crops%ROWTYPE;
  v_water_xp INTEGER := 15;
  v_water_jelly INTEGER := 10;
  v_threshold INTEGER;
  v_new_xp INTEGER;
  v_leveled_up BOOLEAN := false;
  v_jelly_spent INTEGER := 0;
  v_spend_key TEXT;
  v_new_stage INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_crop_id IS NULL THEN
    RAISE EXCEPTION '작물을 선택해 주세요.';
  END IF;

  SELECT * INTO v_crop
  FROM farm_field_crops
  WHERE id = p_crop_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '작물을 찾을 수 없어요.';
  END IF;

  IF v_crop.stage >= 4 THEN
    RAISE EXCEPTION '이미 완전히 자란 작물이에요.';
  END IF;

  SELECT COALESCE(value::INTEGER, 15) INTO v_water_xp
  FROM farm_settings WHERE key = 'crop_water_xp_amount';

  SELECT COALESCE(value::INTEGER, 10) INTO v_water_jelly
  FROM farm_settings WHERE key = 'crop_water_jelly_cost';

  v_spend_key := 'crop_water:' || p_crop_id::text || ':' || gen_random_uuid()::text;
  PERFORM spend_jelly(v_water_jelly, 'crop_water', v_spend_key);
  v_jelly_spent := v_water_jelly;

  v_new_xp := v_crop.xp + v_water_xp;
  v_threshold := get_crop_stage_xp_required(v_crop.stage);

  IF v_threshold IS NULL THEN
    v_threshold := 30;
  END IF;

  IF v_crop.stage < 4 AND v_new_xp >= v_threshold THEN
    v_leveled_up := true;
    v_new_stage := v_crop.stage + 1;

    UPDATE farm_field_crops
    SET stage = v_new_stage,
        xp = v_new_xp - v_threshold,
        updated_at = NOW()
    WHERE id = p_crop_id
    RETURNING * INTO v_crop;
  ELSE
    UPDATE farm_field_crops
    SET xp = v_new_xp,
        updated_at = NOW()
    WHERE id = p_crop_id
    RETURNING * INTO v_crop;
  END IF;

  RETURN json_build_object(
    'crop', json_build_object(
      'id', v_crop.id,
      'row', v_crop.cell_row,
      'col', v_crop.cell_col,
      'stage', v_crop.stage,
      'xp', v_crop.xp,
      'nextStageXpRequired', get_crop_stage_xp_required(v_crop.stage),
      'maxStage', 4
    ),
    'xpAwarded', v_water_xp,
    'jellySpent', v_jelly_spent,
    'leveledUp', v_leveled_up,
    'newStage', CASE WHEN v_leveled_up THEN v_crop.stage ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_farm_field() TO authenticated;
GRANT EXECUTE ON FUNCTION plant_farm_seed(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION water_farm_crop(UUID) TO authenticated;

COMMENT ON TABLE farm_field_crops IS '농장 밭 작물 (5×4 격자, 4단계 성장)';
