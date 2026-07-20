-- 포실이 시계 공부 세션 (할 일 달력에 일별 총 공부량 표시)

CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_date TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  source TEXT NOT NULL DEFAULT 'summer-clock',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date
  ON study_sessions (user_id, study_date);

ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_study_sessions" ON study_sessions;
CREATE POLICY "users_select_own_study_sessions" ON study_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_study_sessions" ON study_sessions;
CREATE POLICY "users_insert_own_study_sessions" ON study_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_study_sessions" ON study_sessions;
CREATE POLICY "users_delete_own_study_sessions" ON study_sessions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
