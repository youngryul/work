-- 권한 관리용 전체 사용자 조회 함수
-- auth.users 접근이 필요하므로 SECURITY DEFINER 사용

CREATE OR REPLACE FUNCTION get_all_users_for_admin()
RETURNS TABLE (
  user_id UUID,
  email TEXT
) AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL OR NOT is_admin(current_user_id) THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  RETURN QUERY
  SELECT
    au.id::UUID AS user_id,
    au.email::TEXT AS email
  FROM auth.users au
  ORDER BY au.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
