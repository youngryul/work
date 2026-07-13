-- 해외 여행 일정 플래너
-- travel_abroad_trips / travel_abroad_itinerary_items

CREATE TABLE IF NOT EXISTS travel_abroad_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  country_code TEXT NOT NULL CHECK (char_length(country_code) = 2 AND country_code <> 'KR'),
  departure_at TIMESTAMPTZ NOT NULL,
  return_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (return_at > departure_at)
);

CREATE INDEX IF NOT EXISTS idx_travel_abroad_trips_user_id
  ON travel_abroad_trips (user_id);

CREATE INDEX IF NOT EXISTS idx_travel_abroad_trips_departure
  ON travel_abroad_trips (user_id, departure_at DESC);

CREATE TABLE IF NOT EXISTS travel_abroad_itinerary_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES travel_abroad_trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_date DATE NOT NULL,
  start_minute INTEGER NOT NULL CHECK (start_minute >= 0 AND start_minute < 1440 AND start_minute % 30 = 0),
  end_minute INTEGER NOT NULL CHECK (end_minute > 0 AND end_minute <= 1440 AND end_minute % 30 = 0),
  title TEXT NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_minute > start_minute)
);

CREATE INDEX IF NOT EXISTS idx_travel_abroad_items_trip_date
  ON travel_abroad_itinerary_items (trip_id, item_date, start_minute);

CREATE INDEX IF NOT EXISTS idx_travel_abroad_items_user_id
  ON travel_abroad_itinerary_items (user_id);

ALTER TABLE travel_abroad_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_abroad_itinerary_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_abroad_trips" ON travel_abroad_trips;
CREATE POLICY "users_select_own_abroad_trips" ON travel_abroad_trips
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_abroad_trips" ON travel_abroad_trips;
CREATE POLICY "users_insert_own_abroad_trips" ON travel_abroad_trips
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_abroad_trips" ON travel_abroad_trips;
CREATE POLICY "users_update_own_abroad_trips" ON travel_abroad_trips
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_abroad_trips" ON travel_abroad_trips;
CREATE POLICY "users_delete_own_abroad_trips" ON travel_abroad_trips
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_select_own_abroad_items" ON travel_abroad_itinerary_items;
CREATE POLICY "users_select_own_abroad_items" ON travel_abroad_itinerary_items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_abroad_items" ON travel_abroad_itinerary_items;
CREATE POLICY "users_insert_own_abroad_items" ON travel_abroad_itinerary_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_abroad_items" ON travel_abroad_itinerary_items;
CREATE POLICY "users_update_own_abroad_items" ON travel_abroad_itinerary_items
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_abroad_items" ON travel_abroad_itinerary_items;
CREATE POLICY "users_delete_own_abroad_items" ON travel_abroad_itinerary_items
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE travel_abroad_trips IS '해외 여행 일정(출국/귀국·국가)';
COMMENT ON TABLE travel_abroad_itinerary_items IS '해외 여행 30분 단위 일정 항목';
