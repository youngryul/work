-- Habit Tracker 데이터베이스 스키마
-- 월별 목표에 연결된 습관 추적 시스템

-- 1. Habit Tracker 테이블
CREATE TABLE IF NOT EXISTS habit_trackers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- 향후 사용자 인증 추가 시 사용
  monthly_goal_id UUID REFERENCES monthly_goals(id) ON DELETE CASCADE, -- 선택 사항
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  title TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#FFB6C1', -- 기본 색상 (연한 핑크)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Habit Tracker 일별 체크 테이블
CREATE TABLE IF NOT EXISTS habit_tracker_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- 향후 사용자 인증 추가 시 사용
  habit_tracker_id UUID NOT NULL REFERENCES habit_trackers(id) ON DELETE CASCADE,
  day INTEGER NOT NULL CHECK (day >= 1 AND day <= 31),
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(habit_tracker_id, day) -- 같은 habit tracker에서 같은 날은 하나만
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_habit_trackers_user_id ON habit_trackers(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_trackers_monthly_goal ON habit_trackers(monthly_goal_id);
CREATE INDEX IF NOT EXISTS idx_habit_trackers_year_month ON habit_trackers(year, month);
CREATE INDEX IF NOT EXISTS idx_habit_tracker_days_user_id ON habit_tracker_days(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_tracker_days_tracker ON habit_tracker_days(habit_tracker_id);
CREATE INDEX IF NOT EXISTS idx_habit_tracker_days_day ON habit_tracker_days(day);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_habit_trackers_updatedat
  BEFORE UPDATE ON habit_trackers
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

CREATE TRIGGER update_habit_tracker_days_updatedat
  BEFORE UPDATE ON habit_tracker_days
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedat_column();

