-- 알림 설정: 2주 이상 지난 백로그 할 일 알림 on/off
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS notification_backlog_stale_enabled boolean DEFAULT true;

COMMENT ON COLUMN user_preferences.notification_backlog_stale_enabled IS '2주 이상 지난 백로그 할 일 알림 사용 여부';
