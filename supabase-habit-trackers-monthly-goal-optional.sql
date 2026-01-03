-- Habit Tracker의 monthly_goal_id를 선택 사항으로 변경 (기존 테이블 마이그레이션)

-- 1. monthly_goal_id 컬럼을 NULL 허용으로 변경
ALTER TABLE habit_trackers 
ALTER COLUMN monthly_goal_id DROP NOT NULL;

