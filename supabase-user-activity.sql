-- 사용자 최근 접속·사용 메뉴
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS user_activity (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_view TEXT NOT NULL DEFAULT '',
  used_views TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_activity_last_seen_at_idx
  ON user_activity (last_seen_at DESC);

ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_activity_own_all" ON user_activity;
CREATE POLICY "user_activity_own_all" ON user_activity
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_activity_admin_select" ON user_activity;
CREATE POLICY "user_activity_admin_select" ON user_activity
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_user_activity(p_view text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL OR p_view IS NULL OR btrim(p_view) = '' THEN
    RETURN;
  END IF;

  INSERT INTO user_activity (user_id, last_seen_at, last_view, used_views, updated_at)
  VALUES (v_user_id, NOW(), p_view, ARRAY[p_view], NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    last_seen_at = NOW(),
    last_view = EXCLUDED.last_view,
    used_views = (
      SELECT COALESCE(
        (ARRAY_AGG(v ORDER BY ord))[1:40],
        ARRAY[p_view]
      )
      FROM (
        SELECT v, MIN(ord) AS ord
        FROM unnest(ARRAY[p_view] || COALESCE(user_activity.used_views, '{}'::text[]))
          WITH ORDINALITY AS t(v, ord)
        WHERE v IS NOT NULL AND btrim(v) <> ''
        GROUP BY v
      ) s
    ),
    updated_at = NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.record_user_activity(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_user_activity(text) TO authenticated;

-- 관리자 유저 목록에 마지막 로그인 시각 추가
DROP FUNCTION IF EXISTS public.get_all_users_for_admin();

CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id AS user_id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u
  ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_all_users_for_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;
