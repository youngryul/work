-- user_roles 테이블 생성
-- 관리자 / 슈퍼유저 / 일반 역할 구분

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'regular' CHECK (role IN ('admin', 'superuser', 'regular')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID
);

-- RLS 활성화
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 자신의 role 조회 가능
CREATE POLICY "users_read_own_role" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 관리자는 모든 role 조회/수정/삭제 가능 (기존 is_admin RPC 함수 사용)
CREATE POLICY "admins_manage_roles" ON user_roles
  FOR ALL USING (is_admin(auth.uid()));

-- 기존 admin_users 에 있는 유저를 admin role 로 자동 삽입
INSERT INTO user_roles (user_id, role)
SELECT user_id, 'admin'
FROM admin_users
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- 이미 테이블이 존재하는 경우 CHECK 제약 업데이트
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin', 'superuser', 'regular'));

