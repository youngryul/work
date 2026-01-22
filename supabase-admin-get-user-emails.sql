-- 관리자가 user_id 배열로 이메일을 조회할 수 있는 함수
-- SECURITY DEFINER로 auth.users 테이블에 접근 가능

CREATE OR REPLACE FUNCTION get_user_emails(user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  email TEXT
) AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- 현재 사용자 ID 가져오기 (SECURITY DEFINER 컨텍스트에서도 작동)
  current_user_id := auth.uid();
  
  -- 관리자 권한 확인 (현재 사용자 ID 명시적 전달)
  IF current_user_id IS NULL OR NOT is_admin(current_user_id) THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  -- auth.users에서 이메일 조회
  -- email을 TEXT로 명시적 캐스팅 (character varying(255) -> TEXT)
  RETURN QUERY
  SELECT 
    au.id::UUID as user_id,
    au.email::TEXT as email
  FROM auth.users au
  WHERE au.id = ANY(user_ids)
  ORDER BY au.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
