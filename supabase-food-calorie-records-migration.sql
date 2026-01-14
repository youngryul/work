-- 음식 칼로리 기록 테이블에 meal_type 컬럼 추가 (기존 테이블이 있는 경우)
-- meal_time 컬럼을 meal_type으로 변경

-- meal_type 컬럼이 없으면 추가
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'food_calorie_records' 
    AND column_name = 'meal_type'
  ) THEN
    ALTER TABLE food_calorie_records 
    ADD COLUMN meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack'));
  END IF;
END $$;

-- meal_time 컬럼이 있으면 제거 (선택사항 - 기존 데이터 보존을 원하면 이 부분을 주석 처리)
-- DO $$ 
-- BEGIN
--   IF EXISTS (
--     SELECT 1 FROM information_schema.columns 
--     WHERE table_name = 'food_calorie_records' 
--     AND column_name = 'meal_time'
--   ) THEN
--     ALTER TABLE food_calorie_records DROP COLUMN meal_time;
--   END IF;
-- END $$;
