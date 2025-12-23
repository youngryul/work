-- 일기 테이블 생성
CREATE TABLE IF NOT EXISTS diaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD 형식
  content TEXT NOT NULL,
  image_url TEXT, -- 생성된 이미지 URL
  image_prompt TEXT, -- 사용된 프롬프트
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_diaries_date ON diaries(date);
CREATE INDEX IF NOT EXISTS idx_diaries_created_at ON diaries(created_at DESC);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_diaries_updatedat
  BEFORE UPDATE ON diaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();
