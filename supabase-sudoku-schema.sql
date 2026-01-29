-- 스도쿠 완료 기록 테이블 생성
CREATE TABLE IF NOT EXISTS sudoku_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  puzzle_id TEXT NOT NULL, -- 퍼즐 ID (예: 'easy-1')
  puzzle_name TEXT NOT NULL, -- 퍼즐 이름 (예: '쉬운 퍼즐 1')
  difficulty TEXT NOT NULL, -- 난이도 (easy, medium, hard, expert)
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, puzzle_id) -- 같은 퍼즐은 한 번만 완료 기록
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sudoku_completions_user_id ON sudoku_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_sudoku_completions_puzzle_id ON sudoku_completions(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_sudoku_completions_difficulty ON sudoku_completions(difficulty);
CREATE INDEX IF NOT EXISTS idx_sudoku_completions_completed_at ON sudoku_completions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sudoku_completions_created_at ON sudoku_completions(created_at DESC);

-- RLS 정책 설정
ALTER TABLE sudoku_completions ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 완료 기록만 조회 가능
CREATE POLICY "Users can view their own sudoku completions" ON sudoku_completions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 완료 기록만 삽입 가능
CREATE POLICY "Users can insert their own sudoku completions" ON sudoku_completions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 완료 기록만 수정 가능
CREATE POLICY "Users can update their own sudoku completions" ON sudoku_completions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 완료 기록만 삭제 가능
CREATE POLICY "Users can delete their own sudoku completions" ON sudoku_completions
  FOR DELETE
  USING (auth.uid() = user_id);
