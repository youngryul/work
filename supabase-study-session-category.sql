-- 타이머 세션 카테고리 (책 / 공부 / 운동)
-- Supabase SQL Editor에서 실행

ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'study';

COMMENT ON COLUMN study_sessions.category IS 'book | study | exercise';

UPDATE study_sessions
SET category = 'study'
WHERE category IS NULL OR category = '';
