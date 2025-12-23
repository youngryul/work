-- 프로젝트 기록 테이블 생성
CREATE TABLE IF NOT EXISTS project_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projectname TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('MEETING', 'DECISION', 'ISSUE', 'IDEA', 'RETROSPECT')),
  date TEXT NOT NULL, -- YYYY-MM-DD 형식
  title TEXT NOT NULL,
  background TEXT,
  discussion TEXT,
  problem TEXT,
  decision TEXT, -- JSON 문자열 (Decision 객체)
  actionitems TEXT, -- JSON 문자열 (ActionItem[] 배열)
  createdat TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updatedat TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_project_records_type ON project_records(type);
CREATE INDEX IF NOT EXISTS idx_project_records_date ON project_records(date);
CREATE INDEX IF NOT EXISTS idx_project_records_projectname ON project_records(projectname);
CREATE INDEX IF NOT EXISTS idx_project_records_createdat ON project_records(createdat DESC);

-- updatedat 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updatedat_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updatedat = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updatedat 자동 업데이트 트리거
CREATE TRIGGER update_project_records_updatedat
  BEFORE UPDATE ON project_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();
