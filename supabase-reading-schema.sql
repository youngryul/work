-- 독서 활동 기록 서비스 데이터베이스 스키마

-- 1. 책 정보 테이블
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, -- 책 제목
  author TEXT, -- 저자
  publisher TEXT, -- 출판사
  isbn TEXT, -- ISBN
  thumbnail_url TEXT, -- 표지 이미지 URL
  description TEXT, -- 책 설명
  page_count INTEGER, -- 총 페이지 수
  published_date TEXT, -- 출판일
  api_source TEXT, -- API 출처 (google_books, aladin 등)
  api_id TEXT, -- API에서 제공하는 책 ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(isbn) -- ISBN으로 중복 방지
);

-- 2. 독서 기록 테이블
CREATE TABLE IF NOT EXISTS reading_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL, -- 독서 날짜
  start_time TIMESTAMP WITH TIME ZONE, -- 시작 시간
  end_time TIMESTAMP WITH TIME ZONE, -- 종료 시간
  reading_minutes INTEGER, -- 독서 시간 (분)
  pages_read INTEGER, -- 읽은 페이지 수
  notes TEXT, -- 독서 메모
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn);
CREATE INDEX IF NOT EXISTS idx_reading_records_book_id ON reading_records(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_records_reading_date ON reading_records(reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_reading_records_created_at ON reading_records(created_at DESC);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_reading_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW
  EXECUTE FUNCTION update_reading_updated_at();

CREATE TRIGGER update_reading_records_updated_at
  BEFORE UPDATE ON reading_records
  FOR EACH ROW
  EXECUTE FUNCTION update_reading_updated_at();

