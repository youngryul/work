-- 가챠 등급 확률 조정 (일반 비중 ↓ / 상위 등급 ↑)
-- Supabase SQL Editor에서 실행
-- 등급 승수: 일반 32 / 레어 28 / 에픽 25 / 레전드 15
-- (캐릭터당 drop_weight가 같다면 대략 그 비율로 나옵니다)

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
      WHEN 'common' THEN 32
      WHEN 'rare' THEN 28
      WHEN 'epic' THEN 25
      WHEN 'legendary' THEN 15
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
      WHEN 'common' THEN 32
      WHEN 'rare' THEN 28
      WHEN 'epic' THEN 25
      WHEN 'legendary' THEN 15
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
