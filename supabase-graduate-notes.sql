-- 대학원 노트 테이블
-- 과목별 예습/강의/복습 기록 저장

CREATE TABLE IF NOT EXISTS graduate_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  semester_id text NOT NULL,          -- 예: '2026-2'
  subject_name text NOT NULL,         -- 예: '세계문학탐구'
  category text NOT NULL CHECK (category IN ('preview', 'lecture', 'review')),
  title text NOT NULL DEFAULT '',
  content jsonb NOT NULL DEFAULT '[]',  -- 블록 배열
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE graduate_notes ENABLE ROW LEVEL SECURITY;

-- 본인만 CRUD 가능
CREATE POLICY "graduate_notes: 본인만 CRUD" ON graduate_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_graduate_notes_user ON graduate_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_graduate_notes_subject ON graduate_notes(user_id, semester_id, subject_name, category);

-- updated_at 자동 갱신 트리거 함수 (없을 경우 생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 적용
DROP TRIGGER IF EXISTS graduate_notes_updated_at ON graduate_notes;
CREATE TRIGGER graduate_notes_updated_at
  BEFORE UPDATE ON graduate_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
