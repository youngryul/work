-- 일정 달력: 연속 일정(기간) 지원
-- schedule_date = 시작일, end_date = 종료일 (단일 일정은 시작일과 동일)

ALTER TABLE schedule_calendar_events
  ADD COLUMN IF NOT EXISTS end_date DATE;

UPDATE schedule_calendar_events
SET end_date = schedule_date
WHERE end_date IS NULL;

ALTER TABLE schedule_calendar_events
  DROP CONSTRAINT IF EXISTS schedule_calendar_events_end_date_check;

ALTER TABLE schedule_calendar_events
  ADD CONSTRAINT schedule_calendar_events_end_date_check
  CHECK (end_date IS NULL OR end_date >= schedule_date);

CREATE INDEX IF NOT EXISTS idx_schedule_calendar_events_user_end_date
  ON schedule_calendar_events (user_id, end_date);

COMMENT ON COLUMN schedule_calendar_events.end_date IS '일정 종료일 (YYYY-MM-DD). NULL이면 schedule_date와 동일한 단일 일정으로 처리';
