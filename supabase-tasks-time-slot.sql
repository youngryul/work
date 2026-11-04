-- 오늘 할 일 시간대(오전/오후/퇴근 후) · 핵심 할 일 · 뽀모도로-할 일 연결
-- Supabase SQL Editor에서 실행

-- 1) 할 일 시간대: 'morning' | 'afternoon' | 'evening' | NULL(미지정)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS time_slot text;

COMMENT ON COLUMN tasks.time_slot IS '계획한 시간대 (morning=오전, afternoon=오후, evening=퇴근 후, NULL=미지정)';

-- 2) 오늘의 핵심 할 일 (Eat the frog)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_key boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN tasks.is_key IS '오늘의 핵심 할 일 여부 (시간대 섹션 맨 위에 표시)';

-- 3) 루틴 기본 시간대: 루틴이 오늘 할 일로 추가될 때 이 시간대로 들어감
ALTER TABLE daily_routines
  ADD COLUMN IF NOT EXISTS time_slot text;

COMMENT ON COLUMN daily_routines.time_slot IS '루틴이 오늘 할 일로 추가될 때의 기본 시간대 (NULL=미지정)';

-- 4) 뽀모도로 세션 ↔ 할 일 연결 (할 일이 삭제돼도 세션 기록은 유지)
ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_title text;

COMMENT ON COLUMN study_sessions.task_id IS '뽀모도로로 집중한 할 일 ID (없으면 NULL)';
COMMENT ON COLUMN study_sessions.task_title IS '기록 당시 할 일 제목 (할 일 삭제·수정 후에도 합계 표시용)';
