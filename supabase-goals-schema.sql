-- 목표 관리 서비스 데이터베이스 스키마
-- 2026년 새해 목표 관리 시스템

-- 1. 연간 목표 테이블
CREATE TABLE IF NOT EXISTS yearly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- 향후 사용자 인증 추가 시 사용
  year INTEGER NOT NULL DEFAULT 2026,
  category TEXT NOT NULL CHECK (category IN ('CAREER', 'HEALTH', 'RELATIONSHIP', 'MONEY', 'GROWTH')),
  title TEXT NOT NULL,
  description TEXT, -- 왜 중요한지
  measurement_criteria TEXT, -- 측정 기준 (정량/정성)
  obstacles TEXT, -- 방해 요소
  strategy TEXT, -- 대응 전략
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'PAUSED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, year, category) -- 한 해에 영역당 하나의 목표만
);

-- 2. 월별 목표 테이블
CREATE TABLE IF NOT EXISTS monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yearly_goal_id UUID NOT NULL REFERENCES yearly_goals(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'PAUSED')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(yearly_goal_id, year, month) -- 한 달에 연간 목표당 하나의 월 목표만
);

-- 3. 주간 행동 테이블
CREATE TABLE IF NOT EXISTS weekly_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_goal_id UUID NOT NULL REFERENCES monthly_goals(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 5),
  action_text TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. 일간 체크리스트 테이블
CREATE TABLE IF NOT EXISTS daily_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_action_id UUID REFERENCES weekly_actions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(date, content) -- 같은 날 같은 내용은 중복 방지
);

-- 5. 월별 회고 테이블
CREATE TABLE IF NOT EXISTS monthly_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  achievement_rate INTEGER CHECK (achievement_rate >= 0 AND achievement_rate <= 100),
  best_choice TEXT, -- 가장 잘한 선택
  failure_reason TEXT, -- 실패 원인 (의지 vs 환경)
  keep_next_month TEXT, -- 다음 달 유지할 것
  drop_next_month TEXT, -- 다음 달 버릴 것
  reflection_text TEXT, -- 자유 회고
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(year, month) -- 한 달에 하나의 회고만
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_yearly_goals_user_year ON yearly_goals(user_id, year);
CREATE INDEX IF NOT EXISTS idx_yearly_goals_category ON yearly_goals(category);
CREATE INDEX IF NOT EXISTS idx_monthly_goals_year_month ON monthly_goals(year, month);
CREATE INDEX IF NOT EXISTS idx_monthly_goals_yearly_goal ON monthly_goals(yearly_goal_id);
CREATE INDEX IF NOT EXISTS idx_weekly_actions_monthly_goal ON weekly_actions(monthly_goal_id);
CREATE INDEX IF NOT EXISTS idx_weekly_actions_year_month_week ON weekly_actions(year, month, week_number);
CREATE INDEX IF NOT EXISTS idx_daily_checks_date ON daily_checks(date);
CREATE INDEX IF NOT EXISTS idx_daily_checks_weekly_action ON daily_checks(weekly_action_id);
CREATE INDEX IF NOT EXISTS idx_monthly_reflections_year_month ON monthly_reflections(year, month);

-- updated_at 자동 업데이트 트리거 함수 (기존 함수 재사용)
-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_yearly_goals_updatedat
  BEFORE UPDATE ON yearly_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

CREATE TRIGGER update_monthly_goals_updatedat
  BEFORE UPDATE ON monthly_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

CREATE TRIGGER update_weekly_actions_updatedat
  BEFORE UPDATE ON weekly_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

CREATE TRIGGER update_daily_checks_updatedat
  BEFORE UPDATE ON daily_checks
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

CREATE TRIGGER update_monthly_reflections_updatedat
  BEFORE UPDATE ON monthly_reflections
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

