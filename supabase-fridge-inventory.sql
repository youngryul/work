-- 냉장고 재고 (냉장실 / 냉동고 / 실온)
-- status: active(보관중) | completed(완료) | discarded(폐기)

CREATE TABLE IF NOT EXISTS fridge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zone TEXT NOT NULL CHECK (zone IN ('fridge', 'freezer', 'pantry')),
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'discarded')),
  registered_at TEXT NOT NULL,
  expires_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 테이블 마이그레이션
ALTER TABLE fridge_items
  ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE fridge_items
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_fridge_items_user_zone
  ON fridge_items (user_id, zone);

CREATE INDEX IF NOT EXISTS idx_fridge_items_user_status
  ON fridge_items (user_id, status);

CREATE INDEX IF NOT EXISTS idx_fridge_items_user_expires
  ON fridge_items (user_id, expires_at ASC NULLS LAST);

ALTER TABLE fridge_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_fridge_items" ON fridge_items;
CREATE POLICY "users_select_own_fridge_items" ON fridge_items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_fridge_items" ON fridge_items;
CREATE POLICY "users_insert_own_fridge_items" ON fridge_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_fridge_items" ON fridge_items;
CREATE POLICY "users_update_own_fridge_items" ON fridge_items
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_fridge_items" ON fridge_items;
CREATE POLICY "users_delete_own_fridge_items" ON fridge_items
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
