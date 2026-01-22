-- 관리자 사용자 테이블 생성
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT -- 관리자 추가 이유나 메모
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 레코드만 조회 가능 (순환 참조 방지)
DROP POLICY IF EXISTS "Users can view own admin record" ON admin_users;
CREATE POLICY "Users can view own admin record" ON admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- 관리자만 추가 가능 (SECURITY DEFINER 함수 사용)
DROP POLICY IF EXISTS "Admins can insert admin users" ON admin_users;
CREATE POLICY "Admins can insert admin users" ON admin_users
  FOR INSERT WITH CHECK (is_admin());

-- 관리자만 삭제 가능 (SECURITY DEFINER 함수 사용)
DROP POLICY IF EXISTS "Admins can delete admin users" ON admin_users;
CREATE POLICY "Admins can delete admin users" ON admin_users
  FOR DELETE USING (is_admin());

-- 관리자 확인 함수 (SECURITY DEFINER로 RLS 우회)
-- 이 함수는 RLS 정책을 우회하여 admin_users 테이블을 직접 조회할 수 있습니다
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

-- 관리자 목록 조회 함수 (SECURITY DEFINER로 RLS 우회)
-- 관리자만 모든 관리자 목록을 조회할 수 있도록 함
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
