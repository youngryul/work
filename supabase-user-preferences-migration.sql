-- user_preferences 테이블에 칼로리 계산기 사용자 정보 컬럼 추가

-- 컬럼 추가 (이미 존재하는 경우 무시)
DO $$ 
BEGIN
  -- 나이
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'age'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN age INTEGER;
  END IF;

  -- 성별
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'gender'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN gender TEXT CHECK (gender IN ('male', 'female'));
  END IF;

  -- 키 (cm)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'height'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN height INTEGER;
  END IF;

  -- 몸무게 (kg)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'weight'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN weight INTEGER;
  END IF;

  -- 활동 수준
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'activity_level'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active'));
  END IF;
END $$;
