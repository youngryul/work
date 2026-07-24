-- 가챠: 캐릭터 가중치 제거, 등급 비율만으로 뽑기
-- Supabase SQL Editor에서 실행
-- 1) 등급 선택: 일반 32 / 레어 28 / 에픽 25 / 레전드 15
--    (해당 등급에 활성 캐릭터가 있을 때만 후보에 포함)
-- 2) 같은 등급 안에서는 균등 랜덤
-- 3) 작물(is_crop)도 활성 상태면 뽑기 풀에 포함

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
  v_total_weight INTEGER;
  v_roll INTEGER;
  v_running INTEGER := 0;
  v_pull_id UUID;
  v_jelly_cost INTEGER;
  v_spend_key TEXT;
  v_selected_grade TEXT;
  v_grade_row RECORD;
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

  -- 활성 캐릭터(작물 포함)가 있는 등급만 합산
  SELECT COALESCE(SUM(g.weight), 0)
  INTO v_total_weight
  FROM (
    SELECT
      CASE c.grade
        WHEN 'common' THEN 32
        WHEN 'rare' THEN 28
        WHEN 'epic' THEN 25
        WHEN 'legendary' THEN 15
        ELSE 10
      END AS weight
    FROM gacha_characters c
    WHERE c.is_active = true
    GROUP BY c.grade
  ) g;

  IF v_total_weight <= 0 THEN
    RAISE EXCEPTION '뽑을 수 있는 포실이가 없습니다. 관리자에게 문의해주세요.';
  END IF;

  v_roll := floor(random() * v_total_weight)::INTEGER;
  v_selected_grade := NULL;

  FOR v_grade_row IN
    SELECT
      c.grade,
      CASE c.grade
        WHEN 'common' THEN 32
        WHEN 'rare' THEN 28
        WHEN 'epic' THEN 25
        WHEN 'legendary' THEN 15
        ELSE 10
      END AS weight
    FROM gacha_characters c
    WHERE c.is_active = true
    GROUP BY c.grade
    ORDER BY
      CASE c.grade
        WHEN 'common' THEN 1
        WHEN 'rare' THEN 2
        WHEN 'epic' THEN 3
        WHEN 'legendary' THEN 4
        ELSE 5
      END
  LOOP
    v_running := v_running + v_grade_row.weight;
    IF v_roll < v_running THEN
      v_selected_grade := v_grade_row.grade;
      EXIT;
    END IF;
  END LOOP;

  IF v_selected_grade IS NULL THEN
    SELECT c.grade INTO v_selected_grade
    FROM gacha_characters c
    WHERE c.is_active = true
    ORDER BY id DESC
    LIMIT 1;
  END IF;

  -- 선택된 등급에서 균등 랜덤 1명 (작물 포함)
  SELECT * INTO v_character
  FROM gacha_characters
  WHERE is_active = true
    AND grade = v_selected_grade
  ORDER BY random()
  LIMIT 1;

  IF v_character.id IS NULL THEN
    RAISE EXCEPTION '뽑을 수 있는 포실이가 없습니다. 관리자에게 문의해주세요.';
  END IF;

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
