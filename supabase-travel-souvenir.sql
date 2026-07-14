-- 해외 여행 기념품 체크리스트
-- travel_abroad_souvenir_items

CREATE TABLE IF NOT EXISTS travel_abroad_souvenir_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES travel_abroad_trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_checked BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_travel_abroad_souvenir_trip
  ON travel_abroad_souvenir_items (trip_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_travel_abroad_souvenir_user
  ON travel_abroad_souvenir_items (user_id);

ALTER TABLE travel_abroad_souvenir_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_abroad_souvenir" ON travel_abroad_souvenir_items;
CREATE POLICY "users_select_own_abroad_souvenir" ON travel_abroad_souvenir_items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_abroad_souvenir" ON travel_abroad_souvenir_items;
CREATE POLICY "users_insert_own_abroad_souvenir" ON travel_abroad_souvenir_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_abroad_souvenir" ON travel_abroad_souvenir_items;
CREATE POLICY "users_update_own_abroad_souvenir" ON travel_abroad_souvenir_items
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_abroad_souvenir" ON travel_abroad_souvenir_items;
CREATE POLICY "users_delete_own_abroad_souvenir" ON travel_abroad_souvenir_items
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE travel_abroad_souvenir_items IS '해외 여행별 기념품 체크리스트';
