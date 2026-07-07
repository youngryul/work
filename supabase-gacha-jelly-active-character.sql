-- 가챠: 젤리 뽑기 + 내 캐릭터(포실이 성장 표시) 연동

INSERT INTO farm_settings (key, value, label) VALUES
  ('gacha_pull_jelly_cost', '10', '가챠 1회 젤리 소비')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE user_farm_progress
  ADD COLUMN IF NOT EXISTS active_character_id UUID REFERENCES gacha_characters(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION get_gacha_pull_jelly_cost()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_cost INTEGER;
BEGIN
  SELECT COALESCE(value::INTEGER, 10) INTO v_cost
  FROM farm_settings
  WHERE key = 'gacha_pull_jelly_cost';
  RETURN COALESCE(v_cost, 10);
END;
$$;

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
  WHERE c.is_active = true;

  IF v_total_weight <= 0 THEN
    RAISE EXCEPTION '뽑을 수 있는 포실이가 없습니다. 관리자에게 문의해주세요.';
  END IF;

  v_roll := floor(random() * v_total_weight)::BIGINT;
  v_running := 0;

  FOR v_character IN
    SELECT * FROM gacha_characters
    WHERE is_active = true
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

CREATE OR REPLACE FUNCTION set_active_gacha_character(p_character_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_char gacha_characters%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_character_id IS NULL THEN
    RAISE EXCEPTION '캐릭터를 선택해 주세요.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM user_gacha_pulls
    WHERE user_id = v_user_id AND character_id = p_character_id
  ) THEN
    RAISE EXCEPTION '보유하지 않은 포실이예요.';
  END IF;

  SELECT * INTO v_char FROM gacha_characters WHERE id = p_character_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '캐릭터를 찾을 수 없어요.';
  END IF;

  INSERT INTO user_farm_progress (user_id, stage, xp, farm_unlocked)
  VALUES (v_user_id, 1, 0, false)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE user_farm_progress
  SET active_character_id = p_character_id,
      updated_at = NOW()
  WHERE user_id = v_user_id;

  RETURN json_build_object(
    'characterId', v_char.id,
    'name', v_char.name,
    'grade', v_char.grade,
    'imageUrl', v_char.image_url
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_my_farm_progress()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_progress user_farm_progress%ROWTYPE;
  v_threshold INTEGER;
  v_seed_count INTEGER := 0;
  v_active_char JSON := NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  INSERT INTO user_farm_progress (user_id, stage, xp, farm_unlocked)
  VALUES (v_user_id, 1, 0, false)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_progress FROM user_farm_progress WHERE user_id = v_user_id;

  IF v_progress.stage >= 2 THEN
    PERFORM grant_stage2_welcome_seed(v_user_id);
  END IF;

  SELECT COALESCE(seed_count, 0) INTO v_seed_count
  FROM user_farm_inventory
  WHERE user_id = v_user_id;

  IF v_progress.active_character_id IS NOT NULL THEN
    SELECT json_build_object(
      'characterId', c.id,
      'name', c.name,
      'grade', c.grade,
      'imageUrl', c.image_url
    ) INTO v_active_char
    FROM gacha_characters c
    WHERE c.id = v_progress.active_character_id;
  END IF;

  IF v_progress.stage >= 10 THEN
    v_threshold := NULL;
  ELSE
    SELECT COALESCE(value::INTEGER, 100) INTO v_threshold
    FROM farm_settings
    WHERE key = 'stage_' || v_progress.stage || '_xp_required';
  END IF;

  RETURN json_build_object(
    'stage', v_progress.stage,
    'xp', v_progress.xp,
    'farmUnlocked', v_progress.farm_unlocked,
    'seedCount', v_seed_count,
    'feedJellyCost', get_milk_feed_jelly_cost(v_progress.stage),
    'gachaPullJellyCost', get_gacha_pull_jelly_cost(),
    'gachaUnlocked', v_progress.stage >= 3,
    'activeCharacter', v_active_char,
    'nextStageXpRequired', v_threshold,
    'maxStage', 10
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_gacha_pull_jelly_cost() TO authenticated;
GRANT EXECUTE ON FUNCTION set_active_gacha_character(UUID) TO authenticated;
