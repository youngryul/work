-- 오늘 할 일 보기 설정: 시간대별 보기 · 지금 시간대만 보기 · 시간대 시작 시각
-- Supabase SQL Editor에서 실행 (user_preferences 테이블에 컬럼 추가)

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS today_time_slot_view boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS today_time_slot_focus boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_slot_morning_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_slot_afternoon_minutes integer DEFAULT 720,
  ADD COLUMN IF NOT EXISTS time_slot_evening_minutes integer DEFAULT 1080,
  ADD COLUMN IF NOT EXISTS today_time_slot_auto_carry boolean DEFAULT false;

COMMENT ON COLUMN user_preferences.today_time_slot_view IS '오늘 할 일 시간대별 보기 사용 여부';
COMMENT ON COLUMN user_preferences.today_time_slot_focus IS '오늘 할 일 지금 시간대만 보기 사용 여부';
COMMENT ON COLUMN user_preferences.time_slot_morning_minutes IS '오전 시작 시각 (하루 중 분, 0 = 00:00)';
COMMENT ON COLUMN user_preferences.time_slot_afternoon_minutes IS '오후 시작 시각 (하루 중 분, 720 = 12:00)';
COMMENT ON COLUMN user_preferences.time_slot_evening_minutes IS '퇴근 후 시작 시각 (하루 중 분, 1080 = 18:00)';
COMMENT ON COLUMN user_preferences.today_time_slot_auto_carry IS '지난 시간대에 못 끝낸 할 일을 지금 시간대로 자동 이월';
