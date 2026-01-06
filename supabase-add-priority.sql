-- tasks 테이블에 priority 필드 추가 (우선순위 순서)
-- 오늘 할일에서 드래그앤드롭으로 순서를 변경할 때 사용
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- priority 인덱스 생성 (정렬 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- 기존 데이터에 priority 값 설정
-- 오늘 할일(istoday = true)인 경우에만 priority를 설정
-- movedtotodayat이 있으면 그것을, 없으면 createdat을 사용하여 초기 priority 설정
-- 단순히 타임스탬프를 정수로 변환하여 사용 (밀리초 단위)
UPDATE tasks
SET priority = COALESCE(movedtotodayat, createdat)
WHERE (priority = 0 OR priority IS NULL) AND istoday = true;

