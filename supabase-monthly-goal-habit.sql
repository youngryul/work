-- 월별 목표 + 습관 트래커 통합
-- Supabase SQL Editor에서 실행
--
-- 1) 월별 목표의 연간 목표 연결을 선택 사항으로 변경
--    (연간 목표 없이도 월별 목표를 적을 수 있게 함)
ALTER TABLE monthly_goals
  ALTER COLUMN yearly_goal_id DROP NOT NULL;

-- 2) 월별 목표 10일 점검 알림 on/off (10일 · 20일 · 말일)
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS notification_monthly_goal_enabled boolean DEFAULT true;

COMMENT ON COLUMN user_preferences.notification_monthly_goal_enabled IS '월별 목표·습관 10일 점검 알림 사용 여부';

-- 참고: "목표에 습관 트래커가 필요하다"는 별도 컬럼 없이
--       habit_trackers.monthly_goal_id 로 연결된 트래커가 있는지로 판단한다.
--       목표 삭제 시 연결된 트래커가 남지 않도록 FK가 CASCADE인지 확인하고, 아니라면 아래를 실행한다.
--
-- SELECT conname, confdeltype FROM pg_constraint
--  WHERE conrelid = 'habit_trackers'::regclass AND contype = 'f';
--  (confdeltype = 'c' 이면 CASCADE)
--
-- ALTER TABLE habit_trackers DROP CONSTRAINT <위에서 확인한 monthly_goal_id FK 이름>;
-- ALTER TABLE habit_trackers
--   ADD CONSTRAINT habit_trackers_monthly_goal_id_fkey
--   FOREIGN KEY (monthly_goal_id) REFERENCES monthly_goals(id) ON DELETE CASCADE;

-- RLS: 새 테이블은 없으며, 기존 monthly_goals / habit_trackers / habit_tracker_days /
--      user_preferences 의 "user_id = auth.uid()" 정책을 그대로 사용한다.
