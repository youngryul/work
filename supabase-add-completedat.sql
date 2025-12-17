-- completedAt 컬럼 추가 마이그레이션
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completedat BIGINT;

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tasks_completedAt ON tasks(completedat DESC);

