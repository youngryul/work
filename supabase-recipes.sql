-- 레시피 관리: 재료 카탈로그 / 레시피 / 레시피-재료

-- ---------------------------------------------------------------------------
-- recipe_ingredient_catalog (공용 시드: user_id IS NULL, 유저 커스텀: user_id 설정)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recipe_ingredient_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('sauce', 'produce', 'other')),
  emoji TEXT NOT NULL DEFAULT '🥗',
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_catalog_user
  ON recipe_ingredient_catalog (user_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_catalog_category
  ON recipe_ingredient_catalog (category, sort_order);

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

-- ---------------------------------------------------------------------------
-- recipes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  image_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipes_user_created
  ON recipes (user_id, created_at DESC);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_recipes" ON recipes;
CREATE POLICY "users_select_own_recipes" ON recipes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_recipes" ON recipes;
CREATE POLICY "users_insert_own_recipes" ON recipes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_recipes" ON recipes;
CREATE POLICY "users_update_own_recipes" ON recipes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_recipes" ON recipes;
CREATE POLICY "users_delete_own_recipes" ON recipes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- recipe_ingredients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  catalog_id UUID REFERENCES recipe_ingredient_catalog(id) ON DELETE SET NULL,
  custom_name TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe
  ON recipe_ingredients (recipe_id, sort_order);

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "users_select_own_recipe_ingredients" ON recipe_ingredients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_ingredients.recipe_id AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_insert_own_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "users_insert_own_recipe_ingredients" ON recipe_ingredients
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_ingredients.recipe_id AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_update_own_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "users_update_own_recipe_ingredients" ON recipe_ingredients
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_ingredients.recipe_id AND r.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_ingredients.recipe_id AND r.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_delete_own_recipe_ingredients" ON recipe_ingredients;
CREATE POLICY "users_delete_own_recipe_ingredients" ON recipe_ingredients
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_ingredients.recipe_id AND r.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 공용 시드 (이미 있으면 스킵)
-- ---------------------------------------------------------------------------
INSERT INTO recipe_ingredient_catalog (name, category, emoji, sort_order)
SELECT v.name, v.category, v.emoji, v.sort_order
FROM (VALUES
  ('간장', 'sauce', '🫙', 10),
  ('소금', 'sauce', '🧂', 20),
  ('설탕', 'sauce', '🍬', 30),
  ('맛술', 'sauce', '🍶', 40),
  ('참기름', 'sauce', '🫗', 50),
  ('식용유', 'sauce', '🫒', 60),
  ('고추장', 'sauce', '🌶️', 70),
  ('된장', 'sauce', '🟤', 80),
  ('고춧가루', 'sauce', '🔴', 90),
  ('다진마늘', 'sauce', '🧄', 100),
  ('후추', 'sauce', '⚫', 110),
  ('식초', 'sauce', '🧪', 120),
  ('올리고당', 'sauce', '🍯', 130),
  ('케첩', 'sauce', '🍅', 140),
  ('마요네즈', 'sauce', '🤍', 150),
  ('양파', 'produce', '🧅', 10),
  ('대파', 'produce', '🥬', 20),
  ('마늘', 'produce', '🧄', 30),
  ('당근', 'produce', '🥕', 40),
  ('감자', 'produce', '🥔', 50),
  ('배추', 'produce', '🥬', 60),
  ('무', 'produce', '⚪', 70),
  ('오이', 'produce', '🥒', 80),
  ('토마토', 'produce', '🍅', 90),
  ('파프리카', 'produce', '🫑', 100),
  ('버섯', 'produce', '🍄', 110),
  ('시금치', 'produce', '🥬', 120),
  ('브로콜리', 'produce', '🥦', 130),
  ('계란', 'produce', '🥚', 140),
  ('두부', 'produce', '⬜', 150),
  ('돼지고기', 'produce', '🥩', 160),
  ('소고기', 'produce', '🍖', 170),
  ('닭고기', 'produce', '🍗', 180),
  ('새우', 'produce', '🦐', 190),
  ('김', 'produce', '🖤', 200)
) AS v(name, category, emoji, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM recipe_ingredient_catalog c
  WHERE c.user_id IS NULL AND c.name = v.name AND c.category = v.category
);
