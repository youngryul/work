-- 여행 앨범을 일정과 분리 (일정에서 가져오기 / 새로 만들기)
-- 기존 사진 압축 여부 컬럼 포함
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS travel_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  country_code TEXT,
  trip_id UUID UNIQUE REFERENCES travel_abroad_trips (id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS travel_albums_user_id_idx ON travel_albums (user_id);

ALTER TABLE travel_albums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "travel_albums_select_own" ON travel_albums;
CREATE POLICY "travel_albums_select_own" ON travel_albums
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "travel_albums_insert_own" ON travel_albums;
CREATE POLICY "travel_albums_insert_own" ON travel_albums
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "travel_albums_update_own" ON travel_albums;
CREATE POLICY "travel_albums_update_own" ON travel_albums
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "travel_albums_delete_own" ON travel_albums;
CREATE POLICY "travel_albums_delete_own" ON travel_albums
  FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE travel_abroad_album_photos
  ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES travel_albums (id) ON DELETE CASCADE;

ALTER TABLE travel_abroad_album_photos
  ADD COLUMN IF NOT EXISTS is_compressed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE travel_abroad_album_photos
  ALTER COLUMN trip_id DROP NOT NULL;

ALTER TABLE travel_abroad_album_photos
  DROP CONSTRAINT IF EXISTS travel_abroad_album_photos_trip_id_fkey;

ALTER TABLE travel_abroad_album_photos
  ADD CONSTRAINT travel_abroad_album_photos_trip_id_fkey
  FOREIGN KEY (trip_id) REFERENCES travel_abroad_trips (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS travel_abroad_album_photos_album_id_idx
  ON travel_abroad_album_photos (album_id);

-- 기존 여행을 앨범으로 이관
INSERT INTO travel_albums (user_id, title, country_code, trip_id, start_date, end_date)
SELECT
  t.user_id,
  t.title,
  t.country_code,
  t.id,
  (t.departure_at AT TIME ZONE 'Asia/Seoul')::date,
  (t.return_at AT TIME ZONE 'Asia/Seoul')::date
FROM travel_abroad_trips t
WHERE NOT EXISTS (
  SELECT 1 FROM travel_albums a WHERE a.trip_id = t.id
);

UPDATE travel_abroad_album_photos p
SET album_id = a.id
FROM travel_albums a
WHERE p.album_id IS NULL
  AND a.trip_id = p.trip_id;

COMMENT ON TABLE travel_albums IS '여행 폴라로이드 앨범 (일정 연동 또는 단독 생성)';
COMMENT ON COLUMN travel_abroad_album_photos.is_compressed IS '업로드/재압축으로 용량을 줄인 사진';
