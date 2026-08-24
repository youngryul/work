-- 여행 폴라로이드 앨범 사진
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS travel_abroad_album_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES travel_abroad_trips (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS travel_abroad_album_photos_trip_id_idx
  ON travel_abroad_album_photos (trip_id);

CREATE INDEX IF NOT EXISTS travel_abroad_album_photos_user_id_idx
  ON travel_abroad_album_photos (user_id);

ALTER TABLE travel_abroad_album_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "travel_abroad_album_photos_select_own" ON travel_abroad_album_photos;
CREATE POLICY "travel_abroad_album_photos_select_own" ON travel_abroad_album_photos
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "travel_abroad_album_photos_insert_own" ON travel_abroad_album_photos;
CREATE POLICY "travel_abroad_album_photos_insert_own" ON travel_abroad_album_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "travel_abroad_album_photos_update_own" ON travel_abroad_album_photos;
CREATE POLICY "travel_abroad_album_photos_update_own" ON travel_abroad_album_photos
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "travel_abroad_album_photos_delete_own" ON travel_abroad_album_photos;
CREATE POLICY "travel_abroad_album_photos_delete_own" ON travel_abroad_album_photos
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE travel_abroad_album_photos IS '여행 폴라로이드 앨범 사진 (앨범당 최대 12장)';
COMMENT ON COLUMN travel_abroad_album_photos.caption IS '폴라로이드 하단 한줄 캡션';
