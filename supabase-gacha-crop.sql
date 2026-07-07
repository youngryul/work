-- 가챠 작물(is_crop) + 농장 4단계 작물 랜덤 이미지

ALTER TABLE gacha_characters
  ADD COLUMN IF NOT EXISTS is_crop BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE farm_field_crops
  ADD COLUMN IF NOT EXISTS crop_gacha_character_id UUID REFERENCES gacha_characters(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION pick_random_crop_gacha_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM gacha_characters
  WHERE is_active = true
    AND is_crop = true
  ORDER BY random()
  LIMIT 1;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION assign_crop_gacha_if_needed(p_crop_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crop farm_field_crops%ROWTYPE;
  v_gacha_id UUID;
BEGIN
  SELECT * INTO v_crop FROM farm_field_crops WHERE id = p_crop_id;
  IF NOT FOUND OR v_crop.stage < 4 OR v_crop.crop_gacha_character_id IS NOT NULL THEN
    RETURN;
  END IF;

  v_gacha_id := pick_random_crop_gacha_id();
  IF v_gacha_id IS NOT NULL THEN
    UPDATE farm_field_crops
    SET crop_gacha_character_id = v_gacha_id,
        updated_at = NOW()
    WHERE id = p_crop_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION build_farm_crop_json(p_crop_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_crop farm_field_crops%ROWTYPE;
  v_image_url TEXT;
  v_crop_name TEXT;
BEGIN
  SELECT * INTO v_crop FROM farm_field_crops WHERE id = p_crop_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_crop.crop_gacha_character_id IS NOT NULL THEN
    SELECT image_url, name INTO v_image_url, v_crop_name
    FROM gacha_characters
    WHERE id = v_crop.crop_gacha_character_id;
  END IF;

  RETURN json_build_object(
    'id', v_crop.id,
    'row', v_crop.cell_row,
    'col', v_crop.cell_col,
    'stage', v_crop.stage,
    'xp', v_crop.xp,
    'nextStageXpRequired', get_crop_stage_xp_required(v_crop.stage),
    'maxStage', 4,
    'cropImageUrl', v_image_url,
    'cropName', v_crop_name
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
    'maxCropStage', 4
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

    IF v_new_stage = 4 THEN
      PERFORM assign_crop_gacha_if_needed(p_crop_id);
    END IF;
  ELSE
    UPDATE farm_field_crops
    SET xp = v_new_xp,
        updated_at = NOW()
    WHERE id = p_crop_id
    RETURNING * INTO v_crop;
  END IF;

  RETURN json_build_object(
    'crop', build_farm_crop_json(p_crop_id),
    'xpAwarded', v_water_xp,
    'jellySpent', v_jelly_spent,
    'leveledUp', v_leveled_up,
    'newStage', CASE WHEN v_leveled_up THEN v_crop.stage ELSE NULL END
  );
END;
$$;

-- 작물 전용 가챠는 일반 뽑기 풀에서 제외
CREATE OR REPLACE FUNCTION draw_gacha_character()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_farm_stage INTEGER := 1;
  v_character gacha_characters%ROWTYPE;
  v_total_weight BIGINT;
  v_roll BIGINT;
  v_running BIGINT;
  v_pull_id UUID;
  v_grade_weight INTEGER;
  v_jelly_cost INTEGER;
  v_spend_key TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT COALESCE(stage, 1) INTO v_farm_stage
  FROM user_farm_progress
  WHERE user_id = v_user_id;

  IF COALESCE(v_farm_stage, 1) < 3 THEN
    RAISE EXCEPTION '뽑기 가챠는 포실이 3단계부터 이용할 수 있어요.';
  END IF;

  v_jelly_cost := get_gacha_pull_jelly_cost();
  v_spend_key := 'gacha_pull:' || gen_random_uuid()::text;
  PERFORM spend_jelly(v_jelly_cost, 'gacha_pull', v_spend_key);

  SELECT COALESCE(SUM(
    c.drop_weight * CASE c.grade
      WHEN 'common' THEN 50
      WHEN 'rare' THEN 30
      WHEN 'epic' THEN 15
      WHEN 'legendary' THEN 5
      ELSE 10
    END
  ), 0)
  INTO v_total_weight
  FROM gacha_characters c
  WHERE c.is_active = true
    AND COALESCE(c.is_crop, false) = false;

  IF v_total_weight <= 0 THEN
    RAISE EXCEPTION '뽑을 수 있는 포실이가 없습니다. 관리자에게 문의해주세요.';
  END IF;

  v_roll := floor(random() * v_total_weight)::BIGINT;
  v_running := 0;

  FOR v_character IN
    SELECT * FROM gacha_characters
    WHERE is_active = true
      AND COALESCE(is_crop, false) = false
    ORDER BY id
  LOOP
    v_grade_weight := CASE v_character.grade
      WHEN 'common' THEN 50
      WHEN 'rare' THEN 30
      WHEN 'epic' THEN 15
      WHEN 'legendary' THEN 5
      ELSE 10
    END;

    v_running := v_running + (v_character.drop_weight * v_grade_weight);

    IF v_roll < v_running THEN
      INSERT INTO user_gacha_pulls (user_id, character_id)
      VALUES (v_user_id, v_character.id)
      RETURNING id INTO v_pull_id;

      RETURN json_build_object(
        'pullId', v_pull_id,
        'characterId', v_character.id,
        'name', v_character.name,
        'grade', v_character.grade,
        'imageUrl', v_character.image_url,
        'jellySpent', v_jelly_cost
      );
    END IF;
  END LOOP;

  SELECT * INTO v_character
  FROM gacha_characters
  WHERE is_active = true
    AND COALESCE(is_crop, false) = false
  ORDER BY id DESC
  LIMIT 1;

  INSERT INTO user_gacha_pulls (user_id, character_id)
  VALUES (v_user_id, v_character.id)
  RETURNING id INTO v_pull_id;

  RETURN json_build_object(
    'pullId', v_pull_id,
    'characterId', v_character.id,
    'name', v_character.name,
    'grade', v_character.grade,
    'imageUrl', v_character.image_url,
    'jellySpent', v_jelly_cost
  );
END;
$$;

GRANT EXECUTE ON FUNCTION pick_random_crop_gacha_id() TO authenticated;
GRANT EXECUTE ON FUNCTION assign_crop_gacha_if_needed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION build_farm_crop_json(UUID) TO authenticated;

COMMENT ON COLUMN gacha_characters.is_crop IS '농장 4단계 작물 이미지 풀 (가챠 뽑기 제외)';
