-- 업무일지 테이블 생성
CREATE TABLE IF NOT EXISTS work_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- 향후 사용자 인증 추가 시 사용 (현재는 임시로 사용)
  date DATE NOT NULL, -- 날짜 (YYYY-MM-DD)
  report_content TEXT NOT NULL, -- 업무일지 내용 (마크다운)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, date) -- 같은 날짜에 하나의 업무일지만
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_work_reports_user_id ON work_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_date ON work_reports(date DESC);
CREATE INDEX IF NOT EXISTS idx_work_reports_created_at ON work_reports(created_at DESC);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_work_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_work_reports_updated_at
  BEFORE UPDATE ON work_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_work_reports_updated_at();

