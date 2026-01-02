-- annual_review 테이블 생성
CREATE TABLE IF NOT EXISTS annual_review (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  reviewdata TEXT NOT NULL,
  completeddays TEXT NOT NULL,
  createdat BIGINT NOT NULL,
  updatedat BIGINT NOT NULL,
  UNIQUE(user_id, year)
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_annual_review_year ON annual_review(year);
CREATE INDEX IF NOT EXISTS idx_annual_review_user_id ON annual_review(user_id);
CREATE INDEX IF NOT EXISTS idx_annual_review_user_year ON annual_review(user_id, year);

-- Row Level Security (RLS) 활성화
ALTER TABLE annual_review ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Allow all operations" ON annual_review;

-- 사용자는 자신의 회고록만 조회 가능
CREATE POLICY "Users can view own annual_review" ON annual_review
  FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 회고록만 생성 가능
CREATE POLICY "Users can insert own annual_review" ON annual_review
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 회고록만 수정 가능
CREATE POLICY "Users can update own annual_review" ON annual_review
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 회고록만 삭제 가능
CREATE POLICY "Users can delete own annual_review" ON annual_review
  FOR DELETE
  USING (auth.uid() = user_id);



