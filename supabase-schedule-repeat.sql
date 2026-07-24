-- 일정 반복 규칙 확장 (주기·요일·월 규칙·종료 방식)
-- Supabase SQL Editor에서 실행 (기존 supabase-schedule-repeat.sql 이후)

ALTER TABLE schedule_calendar_events
  ADD COLUMN IF NOT EXISTS repeat_type TEXT NOT NULL DEFAULT 'none';

ALTER TABLE schedule_calendar_events
  ADD COLUMN IF NOT EXISTS repeat_until TEXT;

ALTER TABLE schedule_calendar_events
  ADD COLUMN IF NOT EXISTS repeat_interval INTEGER NOT NULL DEFAULT 1;

ALTER TABLE schedule_calendar_events
  ADD COLUMN IF NOT EXISTS repeat_weekdays TEXT;

ALTER TABLE schedule_calendar_events
  ADD COLUMN IF NOT EXISTS repeat_monthly_rule TEXT NOT NULL DEFAULT 'day';

ALTER TABLE schedule_calendar_events
  ADD COLUMN IF NOT EXISTS repeat_month_day INTEGER;

ALTER TABLE schedule_calendar_events
  ADD COLUMN IF NOT EXISTS repeat_nth INTEGER;

ALTER TABLE schedule_calendar_events
  ADD COLUMN IF NOT EXISTS repeat_weekday INTEGER;

ALTER TABLE schedule_calendar_events
  ADD COLUMN IF NOT EXISTS repeat_end_type TEXT NOT NULL DEFAULT 'until';

ALTER TABLE schedule_calendar_events
  ADD COLUMN IF NOT EXISTS repeat_count INTEGER;

COMMENT ON COLUMN schedule_calendar_events.repeat_type IS 'none | weekly | monthly | yearly';
COMMENT ON COLUMN schedule_calendar_events.repeat_interval IS 'N주/월/년마다';
COMMENT ON COLUMN schedule_calendar_events.repeat_weekdays IS '주 반복 요일 CSV (0=일..6=토)';
COMMENT ON COLUMN schedule_calendar_events.repeat_monthly_rule IS 'day | nth_weekday | last_weekday | last_day';
COMMENT ON COLUMN schedule_calendar_events.repeat_end_type IS 'never | count | until';

UPDATE schedule_calendar_events
SET repeat_type = 'none'
WHERE repeat_type IS NULL OR repeat_type = '';

UPDATE schedule_calendar_events
SET repeat_end_type = CASE
  WHEN repeat_until IS NOT NULL AND repeat_until <> '' THEN 'until'
  ELSE 'never'
END
WHERE repeat_end_type IS NULL OR repeat_end_type = '';
