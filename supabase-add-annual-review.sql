-- annual_review 테이블 생성
CREATE TABLE IF NOT EXISTS annual_review (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year TEXT NOT NULL,
  reviewdata TEXT NOT NULL,
  completeddays TEXT NOT NULL,
  createdat BIGINT NOT NULL,
  updatedat BIGINT NOT NULL
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_annual_review_year ON annual_review(year);

-- Row Level Security (RLS) 비활성화 (개인 사용, 로그인 없음)
ALTER TABLE annual_review ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 접근 가능하도록 정책 설정
CREATE POLICY "Allow all operations" ON annual_review
  FOR ALL
  USING (true)
  WITH CHECK (true);
