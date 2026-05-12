-- 관리자 통계용 전체 사용자 수 조회 함수
-- auth.users 직접 접근이 필요하므로 SECURITY DEFINER 사용

CREATE OR REPLACE FUNCTION get_total_user_count()
RETURNS INTEGER AS $$
DECLARE
  current_user_id UUID;
  total_count INTEGER;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL OR NOT is_admin(current_user_id) THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO total_count
  FROM auth.users;

  RETURN total_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
