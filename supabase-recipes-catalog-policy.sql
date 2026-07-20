-- 재료 카탈로그: 전체 공개 조회, 공용(user_id NULL) 추가, 이미지·수정·삭제는 관리자만
-- Supabase SQL Editor에서 supabase-recipes.sql 적용 후 이 파일을 실행하세요.

-- 중복 방지 (이름·카테고리, 대소문자·앞뒤 공백 무시)
-- 기존에 같은 이름·카테고리가 여러 행이면 인덱스 생성 전에 정리해야 합니다.
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_ingredient_catalog_unique_name_category
  ON recipe_ingredient_catalog (category, lower(trim(name)));

ALTER TABLE recipe_ingredient_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_recipe_ingredient_catalog" ON recipe_ingredient_catalog;
CREATE POLICY "users_select_recipe_ingredient_catalog" ON recipe_ingredient_catalog
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "users_insert_own_recipe_ingredient_catalog" ON recipe_ingredient_catalog;
DROP POLICY IF EXISTS "users_insert_shared_recipe_ingredient_catalog" ON recipe_ingredient_catalog;
CREATE POLICY "users_insert_shared_recipe_ingredient_catalog" ON recipe_ingredient_catalog
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id IS NULL
    AND (
      is_admin(auth.uid())
      OR image_url IS NULL
    )
  );

DROP POLICY IF EXISTS "users_update_own_recipe_ingredient_catalog" ON recipe_ingredient_catalog;
DROP POLICY IF EXISTS "admins_update_recipe_ingredient_catalog" ON recipe_ingredient_catalog;
CREATE POLICY "admins_update_recipe_ingredient_catalog" ON recipe_ingredient_catalog
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "users_delete_own_recipe_ingredient_catalog" ON recipe_ingredient_catalog;
DROP POLICY IF EXISTS "admins_delete_recipe_ingredient_catalog" ON recipe_ingredient_catalog;
CREATE POLICY "admins_delete_recipe_ingredient_catalog" ON recipe_ingredient_catalog
  FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
