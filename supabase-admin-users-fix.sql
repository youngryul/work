-- admin_users 테이블 RLS 정책 수정
-- 순환 참조 문제 해결

-- 기존 정책 제거
DROP POLICY IF EXISTS "Admins can view admin users" ON admin_users;
DROP POLICY IF EXISTS "Users can view own admin record" ON admin_users;
DROP POLICY IF EXISTS "Admins can insert admin users" ON admin_users;
DROP POLICY IF EXISTS "Admins can delete admin users" ON admin_users;

-- 사용자는 자신의 레코드만 조회 가능 (순환 참조 방지)
CREATE POLICY "Users can view own admin record" ON admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- 관리자만 추가 가능 (SECURITY DEFINER 함수 사용)
CREATE POLICY "Admins can insert admin users" ON admin_users
  FOR INSERT WITH CHECK (is_admin());

-- 관리자만 삭제 가능 (SECURITY DEFINER 함수 사용)
CREATE POLICY "Admins can delete admin users" ON admin_users
  FOR DELETE USING (is_admin());

-- 관리자 확인 함수 재생성 (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  -- SECURITY DEFINER로 실행되므로 RLS 정책을 우회
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 관리자 목록 조회 함수 생성 (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_admin_users_list()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  created_at TIMESTAMPTZ,
  notes TEXT
) AS $$
BEGIN
  -- 호출자가 관리자인지 확인
  IF NOT is_admin() THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  -- 모든 관리자 목록 반환
  RETURN QUERY
  SELECT 
    au.id,
    au.user_id,
    au.created_at,
    au.notes
  FROM admin_users au
  ORDER BY au.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
