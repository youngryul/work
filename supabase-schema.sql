-- tasks 테이블 생성
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  isToday BOOLEAN DEFAULT FALSE,
  category TEXT DEFAULT '작업',
  createdAt BIGINT NOT NULL
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tasks_isToday ON tasks(isToday);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_createdAt ON tasks(createdAt DESC);

-- Row Level Security (RLS) 비활성화 (개인 사용, 로그인 없음)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 접근 가능하도록 정책 설정
CREATE POLICY "Allow all operations" ON tasks
  FOR ALL
  USING (true)
  WITH CHECK (true);

