-- daily_routines: 매일 오늘 할일로 자동 추가되는 루틴
-- Supabase SQL Editor에서 실행하거나 db:push 전에 적용

CREATE TABLE IF NOT EXISTS daily_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '작업',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_applied_date TEXT,
  created_at BIGINT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS daily_routines_user_id_idx ON daily_routines (user_id);

ALTER TABLE daily_routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_routines_select_own" ON daily_routines;
CREATE POLICY "daily_routines_select_own" ON daily_routines
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_routines_insert_own" ON daily_routines;
CREATE POLICY "daily_routines_insert_own" ON daily_routines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_routines_update_own" ON daily_routines;
CREATE POLICY "daily_routines_update_own" ON daily_routines
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "daily_routines_delete_own" ON daily_routines;
CREATE POLICY "daily_routines_delete_own" ON daily_routines
  FOR DELETE USING (auth.uid() = user_id);
