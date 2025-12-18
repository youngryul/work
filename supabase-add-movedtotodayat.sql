-- movedToTodayAt 컬럼 추가 마이그레이션
-- 오늘 할 일로 이동한 시점을 추적하기 위한 필드
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS movedtotodayat BIGINT;

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tasks_movedToTodayAt ON tasks(movedtotodayat DESC);

-- 기존 데이터 중 istoday = true인 항목들의 movedtotodayat을 createdat으로 설정
-- (이미 오늘 할 일로 되어 있는 항목들은 생성 시점을 이동 시점으로 간주)
UPDATE tasks
SET movedtotodayat = createdat
WHERE istoday = true AND movedtotodayat IS NULL;
