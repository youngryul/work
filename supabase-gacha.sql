-- 포실이 가챠 (캡슐 뽑기) 시스템



CREATE TABLE IF NOT EXISTS gacha_characters (

  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,

  grade TEXT NOT NULL CHECK (grade IN ('common', 'rare', 'epic', 'legendary')),

  image_url TEXT NOT NULL,

  drop_weight INTEGER NOT NULL DEFAULT 100 CHECK (drop_weight > 0),

  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



CREATE INDEX IF NOT EXISTS idx_gacha_characters_grade ON gacha_characters (grade);

CREATE INDEX IF NOT EXISTS idx_gacha_characters_is_active ON gacha_characters (is_active);



CREATE TABLE IF NOT EXISTS user_gacha_pulls (

  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  character_id UUID NOT NULL REFERENCES gacha_characters(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);



CREATE INDEX IF NOT EXISTS idx_user_gacha_pulls_user_id ON user_gacha_pulls (user_id);

CREATE INDEX IF NOT EXISTS idx_user_gacha_pulls_character_id ON user_gacha_pulls (character_id);

CREATE INDEX IF NOT EXISTS idx_user_gacha_pulls_created_at ON user_gacha_pulls (created_at DESC);



ALTER TABLE gacha_characters ENABLE ROW LEVEL SECURITY;

ALTER TABLE user_gacha_pulls ENABLE ROW LEVEL SECURITY;



-- 활성 캐릭터는 로그인 사용자 조회 가능

DROP POLICY IF EXISTS "users_read_active_gacha_characters" ON gacha_characters;

CREATE POLICY "users_read_active_gacha_characters" ON gacha_characters

  FOR SELECT TO authenticated

  USING (is_active = true);



DROP POLICY IF EXISTS "admins_manage_gacha_characters" ON gacha_characters;

CREATE POLICY "admins_manage_gacha_characters" ON gacha_characters

  FOR ALL TO authenticated

  USING (is_admin(auth.uid()))

  WITH CHECK (is_admin(auth.uid()));



DROP POLICY IF EXISTS "users_read_own_gacha_pulls" ON user_gacha_pulls;

CREATE POLICY "users_read_own_gacha_pulls" ON user_gacha_pulls

  FOR SELECT TO authenticated

  USING (auth.uid() = user_id);



-- 가챠 뽑기 (가중치 랜덤 + 컬렉션 저장)

CREATE OR REPLACE FUNCTION draw_gacha_character()

RETURNS JSON

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = public

AS $$

DECLARE

  v_user_id UUID := auth.uid();

  v_character gacha_characters%ROWTYPE;

  v_total_weight BIGINT;

  v_roll BIGINT;

  v_running BIGINT;

  v_pull_id UUID;

  v_grade_weight INTEGER;

BEGIN

  IF v_user_id IS NULL THEN

    RAISE EXCEPTION '로그인이 필요합니다.';

  END IF;



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

        'imageUrl', v_character.image_url

      );

    END IF;

  END LOOP;



  -- 부동소수점 엣지 케이스: 마지막 캐릭터 반환

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

    'imageUrl', v_character.image_url

  );

END;

$$;



GRANT EXECUTE ON FUNCTION draw_gacha_character() TO authenticated;



COMMENT ON TABLE gacha_characters IS '가챠 포실이 캐릭터 (관리자 등록)';

COMMENT ON TABLE user_gacha_pulls IS '사용자 가챠 뽑기 기록';


