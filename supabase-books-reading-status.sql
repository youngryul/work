-- 책 읽는 중 여부 / 현재 읽은 페이지 컬럼 추가
-- 완료 여부(is_completed)와 함께 '읽는 중 / 읽기 전 / 완료' 3구분에 사용

ALTER TABLE books ADD COLUMN IF NOT EXISTS is_reading boolean NOT NULL DEFAULT false;
ALTER TABLE books ADD COLUMN IF NOT EXISTS current_page integer NOT NULL DEFAULT 0;
