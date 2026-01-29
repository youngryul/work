-- 네모 로직 완료 기록 테이블 생성
CREATE TABLE IF NOT EXISTS nonogram_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  puzzle_id TEXT NOT NULL, -- 퍼즐 ID (예: 'heart-5x5')
  puzzle_name TEXT NOT NULL, -- 퍼즐 이름 (예: '하트')
  puzzle_size INTEGER NOT NULL, -- 퍼즐 크기 (예: 5)
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, puzzle_id) -- 같은 퍼즐은 한 번만 완료 기록
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_nonogram_completions_user_id ON nonogram_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_nonogram_completions_puzzle_id ON nonogram_completions(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_nonogram_completions_completed_at ON nonogram_completions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nonogram_completions_created_at ON nonogram_completions(created_at DESC);

-- RLS 정책 설정
ALTER TABLE nonogram_completions ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 완료 기록만 조회 가능
CREATE POLICY "Users can view their own completions" ON nonogram_completions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 완료 기록만 삽입 가능
CREATE POLICY "Users can insert their own completions" ON nonogram_completions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 완료 기록만 수정 가능
CREATE POLICY "Users can update their own completions" ON nonogram_completions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 완료 기록만 삭제 가능
CREATE POLICY "Users can delete their own completions" ON nonogram_completions
  FOR DELETE
  USING (auth.uid() = user_id);
