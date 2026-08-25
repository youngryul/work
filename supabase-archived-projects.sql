-- archived_projects: 프로젝트 기록의 프로젝트 단위 보관
-- 보관한 프로젝트는 프로젝트 목록에서 숨기고 보관함에서만 조회한다.
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS archived_projects (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_name)
);

CREATE INDEX IF NOT EXISTS archived_projects_user_id_idx ON archived_projects (user_id);

ALTER TABLE archived_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "archived_projects_select_own" ON archived_projects;
CREATE POLICY "archived_projects_select_own" ON archived_projects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "archived_projects_insert_own" ON archived_projects;
CREATE POLICY "archived_projects_insert_own" ON archived_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "archived_projects_update_own" ON archived_projects;
CREATE POLICY "archived_projects_update_own" ON archived_projects
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "archived_projects_delete_own" ON archived_projects;
CREATE POLICY "archived_projects_delete_own" ON archived_projects
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE archived_projects IS '프로젝트 기록에서 보관 처리한 프로젝트명 (사용자별)';
