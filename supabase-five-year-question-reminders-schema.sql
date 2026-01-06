-- 5년 질문 일기 리마인더 테이블 생성
-- 사용자가 하루에 한 번만 5년 질문 일기 리마인더를 받도록 관리

CREATE TABLE IF NOT EXISTS five_year_question_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_date DATE NOT NULL, -- 리마인더가 표시된 날짜 (YYYY-MM-DD)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, reminder_date) -- 같은 사용자가 같은 날에 한 번만 리마인더 표시
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_five_year_question_reminders_user_id ON five_year_question_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_five_year_question_reminders_date ON five_year_question_reminders(reminder_date);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_five_year_question_reminders_updatedat
  BEFORE UPDATE ON five_year_question_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

-- ============================================
-- Row Level Security (RLS) 정책 설정
-- ============================================

ALTER TABLE five_year_question_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own five_year_question_reminders" ON five_year_question_reminders;
DROP POLICY IF EXISTS "Users can insert own five_year_question_reminders" ON five_year_question_reminders;
DROP POLICY IF EXISTS "Users can update own five_year_question_reminders" ON five_year_question_reminders;
DROP POLICY IF EXISTS "Users can delete own five_year_question_reminders" ON five_year_question_reminders;

CREATE POLICY "Users can view own five_year_question_reminders" ON five_year_question_reminders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own five_year_question_reminders" ON five_year_question_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own five_year_question_reminders" ON five_year_question_reminders
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own five_year_question_reminders" ON five_year_question_reminders
  FOR DELETE USING (auth.uid() = user_id);

