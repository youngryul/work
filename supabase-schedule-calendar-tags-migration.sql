-- 기존 일정 달력 사용자에게 태그 동기화 테이블 추가
-- 이미 supabase-schedule-calendar.sql을 실행한 환경에서 추가로 실행하세요.

CREATE TABLE IF NOT EXISTS schedule_calendar_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_schedule_calendar_tags_user_id
  ON schedule_calendar_tags (user_id);

ALTER TABLE schedule_calendar_tags ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'schedule_calendar_tags' AND policyname = 'users_select_own_schedule_tags'
  ) THEN
    CREATE POLICY "users_select_own_schedule_tags" ON schedule_calendar_tags
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'schedule_calendar_tags' AND policyname = 'users_insert_own_schedule_tags'
  ) THEN
    CREATE POLICY "users_insert_own_schedule_tags" ON schedule_calendar_tags
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'schedule_calendar_tags' AND policyname = 'users_update_own_schedule_tags'
  ) THEN
    CREATE POLICY "users_update_own_schedule_tags" ON schedule_calendar_tags
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'schedule_calendar_tags' AND policyname = 'users_delete_own_schedule_tags'
  ) THEN
    CREATE POLICY "users_delete_own_schedule_tags" ON schedule_calendar_tags
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END$$;

DROP TRIGGER IF EXISTS update_schedule_calendar_tags_updatedat ON schedule_calendar_tags;
CREATE TRIGGER update_schedule_calendar_tags_updatedat
  BEFORE UPDATE ON schedule_calendar_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

-- 기존 사용자에게 기본 태그 자동 생성(없는 사용자만)
INSERT INTO schedule_calendar_tags (user_id, name, color)
SELECT DISTINCT e.user_id, t.name, t.color
FROM schedule_calendar_events e
CROSS JOIN (
  VALUES
    ('업무', 'bg-blue-100 text-blue-700 border-blue-200'),
    ('개인', 'bg-purple-100 text-purple-700 border-purple-200'),
    ('약속', 'bg-emerald-100 text-emerald-700 border-emerald-200'),
    ('가족', 'bg-pink-100 text-pink-700 border-pink-200'),
    ('기타', 'bg-gray-100 text-gray-700 border-gray-200')
) AS t(name, color)
ON CONFLICT (user_id, name) DO NOTHING;
