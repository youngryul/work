-- 음식 칼로리 기록 테이블 생성
CREATE TABLE IF NOT EXISTS food_calorie_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL, -- 음식명
  calories INTEGER NOT NULL, -- 칼로리
  carbs DECIMAL(10, 1) NOT NULL, -- 탄수화물 (g)
  protein DECIMAL(10, 1) NOT NULL, -- 단백질 (g)
  fat DECIMAL(10, 1) NOT NULL, -- 지방 (g)
  serving_size TEXT, -- 1인분 등
  image_url TEXT, -- 업로드한 이미지 URL (선택)
  meal_date DATE NOT NULL DEFAULT CURRENT_DATE, -- 식사 날짜
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')), -- 식사 종류 (아침/점심/저녁/간식)
  notes TEXT, -- 메모 (선택)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_food_calorie_records_user_id ON food_calorie_records(user_id);
CREATE INDEX IF NOT EXISTS idx_food_calorie_records_meal_date ON food_calorie_records(meal_date DESC);
CREATE INDEX IF NOT EXISTS idx_food_calorie_records_created_at ON food_calorie_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_food_calorie_records_user_date ON food_calorie_records(user_id, meal_date DESC);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_food_calorie_records_updatedat()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_food_calorie_records_updatedat
  BEFORE UPDATE ON food_calorie_records
  FOR EACH ROW
  EXECUTE FUNCTION update_food_calorie_records_updatedat();

-- RLS (Row Level Security) 정책 설정
ALTER TABLE food_calorie_records ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (이미 존재하는 경우)
DROP POLICY IF EXISTS "Users can view own food calorie records" ON food_calorie_records;
DROP POLICY IF EXISTS "Users can insert own food calorie records" ON food_calorie_records;
DROP POLICY IF EXISTS "Users can update own food calorie records" ON food_calorie_records;
DROP POLICY IF EXISTS "Users can delete own food calorie records" ON food_calorie_records;

-- RLS 정책 생성
CREATE POLICY "Users can view own food calorie records" ON food_calorie_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own food calorie records" ON food_calorie_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own food calorie records" ON food_calorie_records
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own food calorie records" ON food_calorie_records
  FOR DELETE USING (auth.uid() = user_id);
