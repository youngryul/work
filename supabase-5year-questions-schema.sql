-- 5년 질문 일기 관련 테이블 스키마

-- 질문 테이블 (365개의 고정 질문)
CREATE TABLE IF NOT EXISTS five_year_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  day_of_year INTEGER NOT NULL CHECK (day_of_year >= 1 AND day_of_year <= 365),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(day_of_year)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_five_year_questions_day ON five_year_questions(day_of_year);

-- 사용자 답변 테이블
CREATE TABLE IF NOT EXISTS five_year_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES five_year_questions(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, question_id, year) -- 같은 질문에 같은 연도로 중복 답변 방지
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_five_year_answers_user_id ON five_year_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_five_year_answers_question_id ON five_year_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_five_year_answers_year ON five_year_answers(year);
CREATE INDEX IF NOT EXISTS idx_five_year_answers_user_question_year ON five_year_answers(user_id, question_id, year);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_five_year_answers_updatedat()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_five_year_answers_updatedat
  BEFORE UPDATE ON five_year_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_five_year_answers_updatedat();

-- ============================================
-- Row Level Security (RLS) 정책 설정
-- ============================================

-- five_year_questions 테이블 RLS (모든 사용자가 조회 가능)
ALTER TABLE five_year_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all questions" ON five_year_questions;
CREATE POLICY "Users can view all questions" ON five_year_questions
  FOR SELECT USING (true);

-- five_year_answers 테이블 RLS
ALTER TABLE five_year_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own answers" ON five_year_answers;
DROP POLICY IF EXISTS "Users can insert own answers" ON five_year_answers;
DROP POLICY IF EXISTS "Users can update own answers" ON five_year_answers;
DROP POLICY IF EXISTS "Users can delete own answers" ON five_year_answers;

CREATE POLICY "Users can view own answers" ON five_year_answers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own answers" ON five_year_answers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own answers" ON five_year_answers
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own answers" ON five_year_answers
  FOR DELETE USING (auth.uid() = user_id);

