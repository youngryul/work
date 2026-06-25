-- books 테이블에 독서 완료 일자 컬럼 추가
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS completed_at date;

COMMENT ON COLUMN books.completed_at IS '독서 완료 일자 (YYYY-MM-DD)';
