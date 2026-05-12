-- 신규 회원가입 시 user_roles에 regular 권한 자동 부여
-- 기존 사용자 중 누락된 role 레코드도 함께 보정

CREATE OR REPLACE FUNCTION public.assign_default_role_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'regular')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;

CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_role_on_signup();

-- 기존 auth.users 사용자 중 user_roles가 없는 계정 보정
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'regular'
FROM auth.users au
LEFT JOIN public.user_roles ur ON ur.user_id = au.id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;
