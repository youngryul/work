-- 관리자용 전체 유저 목록 (가입일 포함)
-- Supabase SQL Editor에서 실행
-- 반환 타입이 바뀌므로 기존 함수를 먼저 삭제합니다.

DROP FUNCTION IF EXISTS public.get_all_users_for_admin();

CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    u.email::text,
    u.created_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_all_users_for_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;
