-- 알림 설정 컬럼 추가 (user_preferences 테이블)

-- 컬럼 추가 (이미 존재하는 경우 무시)
DO $$ 
BEGIN
  -- 일기 알림 설정
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'notification_diary_enabled'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN notification_diary_enabled BOOLEAN DEFAULT true;
  END IF;

  -- 주간 요약 알림 설정
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'notification_weekly_summary_enabled'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN notification_weekly_summary_enabled BOOLEAN DEFAULT true;
  END IF;

  -- 월간 요약 알림 설정
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'notification_monthly_summary_enabled'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN notification_monthly_summary_enabled BOOLEAN DEFAULT true;
  END IF;

  -- 5년 질문 알림 설정
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'notification_five_year_question_enabled'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN notification_five_year_question_enabled BOOLEAN DEFAULT true;
  END IF;
END $$;
