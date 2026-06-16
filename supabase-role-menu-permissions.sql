-- 역할별 사이드바 메뉴 권한 (관리자 설정)

CREATE TABLE IF NOT EXISTS role_menu_permissions (
  role TEXT PRIMARY KEY CHECK (role IN ('admin', 'superuser', 'regular')),
  allowed_menu_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  allowed_footer_menu_ids TEXT[] NOT NULL DEFAULT ARRAY['announcements', 'my-page', 'settings']::TEXT[],
  allowed_external_link_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  show_admin_menu BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE role_menu_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_role_menu_permissions" ON role_menu_permissions;
CREATE POLICY "authenticated_read_role_menu_permissions" ON role_menu_permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admins_manage_role_menu_permissions" ON role_menu_permissions;
CREATE POLICY "admins_manage_role_menu_permissions" ON role_menu_permissions
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- 기본 권한 (현재 앱 동작 기준)
INSERT INTO role_menu_permissions (
  role,
  allowed_menu_ids,
  allowed_footer_menu_ids,
  allowed_external_link_ids,
  show_admin_menu
) VALUES
  (
    'regular',
    ARRAY['today', 'backlog', 'todo-calendar', 'diary-calendar', 'gacha']::TEXT[],
    ARRAY['announcements', 'my-page', 'settings']::TEXT[],
    ARRAY[]::TEXT[],
    false
  ),
  (
    'superuser',
    ARRAY[
      'today', 'backlog', 'todo-calendar', 'diary-calendar', 'gacha',
      'schedule-calendar', 'records', 'goals', 'habit-tracker', 'bucketlist',
      'reading', 'travel-menu', 'travel', 'domestic-travel', 'five-year-questions',
      'food-calorie', 'congratulatory-money', 'games', 'nonogram', 'sudoku',
      'review-menu', 'review', 'review-2026'
    ]::TEXT[],
    ARRAY['announcements', 'my-page', 'settings']::TEXT[],
    ARRAY['tarot', 'money']::TEXT[],
    false
  ),
  (
    'admin',
    ARRAY[
      'today', 'backlog', 'todo-calendar', 'diary-calendar', 'gacha',
      'schedule-calendar', 'records', 'goals', 'habit-tracker', 'bucketlist',
      'reading', 'travel-menu', 'travel', 'domestic-travel', 'five-year-questions',
      'food-calorie', 'congratulatory-money', 'games', 'nonogram', 'sudoku',
      'review-menu', 'review', 'review-2026'
    ]::TEXT[],
    ARRAY['announcements', 'my-page', 'settings']::TEXT[],
    ARRAY['tarot', 'money']::TEXT[],
    true
  )
ON CONFLICT (role) DO NOTHING;

-- 로그인 사용자 역할에 맞는 메뉴 권한 조회
CREATE OR REPLACE FUNCTION get_my_menu_permissions()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT := 'regular';
  v_row role_menu_permissions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT role INTO v_role
  FROM user_roles
  WHERE user_id = v_user_id;

  v_role := COALESCE(v_role, 'regular');

  SELECT * INTO v_row
  FROM role_menu_permissions
  WHERE role = v_role;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'role', v_role,
      'allowedMenuIds', ARRAY['today', 'backlog', 'todo-calendar', 'diary-calendar', 'gacha'],
      'allowedFooterMenuIds', ARRAY['announcements', 'my-page', 'settings'],
      'allowedExternalLinkIds', ARRAY[]::TEXT[],
      'showAdminMenu', v_role = 'admin'
    );
  END IF;

  RETURN json_build_object(
    'role', v_role,
    'allowedMenuIds', v_row.allowed_menu_ids,
    'allowedFooterMenuIds', v_row.allowed_footer_menu_ids,
    'allowedExternalLinkIds', v_row.allowed_external_link_ids,
    'showAdminMenu', v_row.show_admin_menu
  );
END;
$$;

-- 관리자: 역할별 메뉴 권한 저장
CREATE OR REPLACE FUNCTION admin_upsert_role_menu_permissions(
  p_role TEXT,
  p_allowed_menu_ids TEXT[],
  p_allowed_footer_menu_ids TEXT[],
  p_allowed_external_link_ids TEXT[],
  p_show_admin_menu BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row role_menu_permissions%ROWTYPE;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  IF p_role NOT IN ('admin', 'superuser', 'regular') THEN
    RAISE EXCEPTION '유효하지 않은 역할입니다.';
  END IF;

  INSERT INTO role_menu_permissions (
    role,
    allowed_menu_ids,
    allowed_footer_menu_ids,
    allowed_external_link_ids,
    show_admin_menu,
    updated_at
  ) VALUES (
    p_role,
    COALESCE(p_allowed_menu_ids, ARRAY[]::TEXT[]),
    COALESCE(p_allowed_footer_menu_ids, ARRAY['announcements', 'my-page', 'settings']::TEXT[]),
    COALESCE(p_allowed_external_link_ids, ARRAY[]::TEXT[]),
    COALESCE(p_show_admin_menu, false),
    NOW()
  )
  ON CONFLICT (role) DO UPDATE SET
    allowed_menu_ids = EXCLUDED.allowed_menu_ids,
    allowed_footer_menu_ids = EXCLUDED.allowed_footer_menu_ids,
    allowed_external_link_ids = EXCLUDED.allowed_external_link_ids,
    show_admin_menu = EXCLUDED.show_admin_menu,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'role', v_row.role,
    'allowedMenuIds', v_row.allowed_menu_ids,
    'allowedFooterMenuIds', v_row.allowed_footer_menu_ids,
    'allowedExternalLinkIds', v_row.allowed_external_link_ids,
    'showAdminMenu', v_row.show_admin_menu
  );
END;
$$;

-- 관리자: 전체 역할 메뉴 권한 목록
CREATE OR REPLACE FUNCTION admin_get_all_role_menu_permissions()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  SELECT COALESCE(json_agg(
    json_build_object(
      'role', role,
      'allowedMenuIds', allowed_menu_ids,
      'allowedFooterMenuIds', allowed_footer_menu_ids,
      'allowedExternalLinkIds', allowed_external_link_ids,
      'showAdminMenu', show_admin_menu,
      'updatedAt', updated_at
    )
    ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'superuser' THEN 2 ELSE 3 END
  ), '[]'::JSON)
  INTO v_result
  FROM role_menu_permissions;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_menu_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_upsert_role_menu_permissions(TEXT, TEXT[], TEXT[], TEXT[], BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_all_role_menu_permissions() TO authenticated;

COMMENT ON TABLE role_menu_permissions IS '역할별 사이드바 메뉴 접근 권한';
