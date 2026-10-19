-- daily_routines: 요일별 반복 설정
-- Supabase SQL Editor에서 실행 (supabase-daily-routines.sql 이후)

ALTER TABLE daily_routines
  ADD COLUMN IF NOT EXISTS repeat_weekdays TEXT;

COMMENT ON COLUMN daily_routines.repeat_weekdays IS '반복 요일 CSV (0=일..6=토). NULL 또는 빈 값이면 매일';
