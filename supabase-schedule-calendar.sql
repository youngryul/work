-- 일정 달력 (Calendar) 테이블
-- 목적: 단순 일정 추가/삭제 + 태그 관리

CREATE TABLE IF NOT EXISTS schedule_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  schedule_date DATE NOT NULL,
  title TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '기타',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_calendar_events_user_id
  ON schedule_calendar_events (user_id);

CREATE INDEX IF NOT EXISTS idx_schedule_calendar_events_date
  ON schedule_calendar_events (schedule_date);

CREATE INDEX IF NOT EXISTS idx_schedule_calendar_events_user_date
  ON schedule_calendar_events (user_id, schedule_date);

ALTER TABLE schedule_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_schedule_events" ON schedule_calendar_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_schedule_events" ON schedule_calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_schedule_events" ON schedule_calendar_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_schedule_events" ON schedule_calendar_events
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_schedule_calendar_events_updatedat
  BEFORE UPDATE ON schedule_calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

-- 태그 설정 테이블 (유저별 태그명 + 색상)
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

CREATE POLICY "users_select_own_schedule_tags" ON schedule_calendar_tags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_schedule_tags" ON schedule_calendar_tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_schedule_tags" ON schedule_calendar_tags
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_schedule_tags" ON schedule_calendar_tags
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_schedule_calendar_tags_updatedat
  BEFORE UPDATE ON schedule_calendar_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();
