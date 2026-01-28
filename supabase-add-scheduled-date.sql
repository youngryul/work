-- tasks 테이블에 scheduled_date 필드 추가
-- 백로그에서 날짜 예약 시 해당 날짜에 오늘 할일로 자동 이동하기 위한 필드

ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS scheduled_date TEXT; -- YYYY-MM-DD 형식

-- 인덱스 생성 (예약된 날짜 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date ON tasks(scheduled_date);

-- 코멘트 추가
COMMENT ON COLUMN tasks.scheduled_date IS '날짜 예약 (YYYY-MM-DD 형식). 해당 날짜에 오늘 할일로 자동 이동됨';
