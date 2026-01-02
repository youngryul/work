-- 방문 국가 관리 서비스 데이터베이스 스키마

-- 방문 국가 테이블
CREATE TABLE IF NOT EXISTS visited_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL, -- ISO 3166-1 alpha-2 국가 코드 (예: 'KR', 'US', 'JP')
  visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL, -- 방문 시점
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, country_code) -- 사용자별 국가 코드 중복 방지
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_visited_countries_user_id ON visited_countries(user_id);
CREATE INDEX IF NOT EXISTS idx_visited_countries_country_code ON visited_countries(country_code);
CREATE INDEX IF NOT EXISTS idx_visited_countries_visited_at ON visited_countries(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_visited_countries_created_at ON visited_countries(created_at DESC);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_visited_countries_updatedat()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_visited_countries_updatedat
  BEFORE UPDATE ON visited_countries
  FOR EACH ROW
  EXECUTE FUNCTION update_visited_countries_updatedat();

-- RLS (Row Level Security) 정책 설정
ALTER TABLE visited_countries ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (이미 존재하는 경우)
DROP POLICY IF EXISTS "Users can view their own visited countries" ON visited_countries;
DROP POLICY IF EXISTS "Users can insert their own visited countries" ON visited_countries;
DROP POLICY IF EXISTS "Users can delete their own visited countries" ON visited_countries;
DROP POLICY IF EXISTS "Users can update their own visited countries" ON visited_countries;

-- 사용자는 자신의 방문 국가만 조회 가능
CREATE POLICY "Users can view their own visited countries"
  ON visited_countries
  FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 방문 국가만 추가 가능
CREATE POLICY "Users can insert their own visited countries"
  ON visited_countries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 방문 국가만 삭제 가능
CREATE POLICY "Users can delete their own visited countries"
  ON visited_countries
  FOR DELETE
  USING (auth.uid() = user_id);

-- 사용자는 자신의 방문 국가만 수정 가능
CREATE POLICY "Users can update their own visited countries"
  ON visited_countries
  FOR UPDATE
  USING (auth.uid() = user_id);

