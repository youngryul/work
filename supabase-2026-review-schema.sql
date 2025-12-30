-- 2026년 회고록 관련 테이블 스키마

-- 주간 업무일지 테이블
CREATE TABLE IF NOT EXISTS weekly_work_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL, -- 주 시작일 (일요일)
  week_end DATE NOT NULL, -- 주 종료일 (토요일)
  year INTEGER NOT NULL, -- 연도
  report_content TEXT NOT NULL, -- 주간 업무일지 내용
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(week_start, week_end)
);

-- 월간 업무일지 테이블
CREATE TABLE IF NOT EXISTS monthly_work_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  report_content TEXT NOT NULL, -- 월간 업무일지 내용 (편지 형식)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(year, month)
);

-- 주간 일기 정리 테이블
CREATE TABLE IF NOT EXISTS weekly_diary_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL, -- 주 시작일 (일요일)
  week_end DATE NOT NULL, -- 주 종료일 (토요일)
  year INTEGER NOT NULL, -- 연도
  summary_content TEXT NOT NULL, -- 주간 일기 정리 내용
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(week_start, week_end)
);

-- 월간 일기 정리 테이블
CREATE TABLE IF NOT EXISTS monthly_diary_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  summary_content TEXT NOT NULL, -- 월간 일기 정리 내용 (편지 형식)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(year, month)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_weekly_work_reports_year ON weekly_work_reports(year);
CREATE INDEX IF NOT EXISTS idx_weekly_work_reports_week_start ON weekly_work_reports(week_start);
CREATE INDEX IF NOT EXISTS idx_monthly_work_reports_year_month ON monthly_work_reports(year, month);
CREATE INDEX IF NOT EXISTS idx_weekly_diary_summaries_year ON weekly_diary_summaries(year);
CREATE INDEX IF NOT EXISTS idx_weekly_diary_summaries_week_start ON weekly_diary_summaries(week_start);
CREATE INDEX IF NOT EXISTS idx_monthly_diary_summaries_year_month ON monthly_diary_summaries(year, month);

-- updated_at 자동 업데이트 트리거 함수 (기존 함수 재사용)
CREATE OR REPLACE FUNCTION update_updatedat_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_weekly_work_reports_updatedat
  BEFORE UPDATE ON weekly_work_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

CREATE TRIGGER update_monthly_work_reports_updatedat
  BEFORE UPDATE ON monthly_work_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

CREATE TRIGGER update_weekly_diary_summaries_updatedat
  BEFORE UPDATE ON weekly_diary_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

CREATE TRIGGER update_monthly_diary_summaries_updatedat
  BEFORE UPDATE ON monthly_diary_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

