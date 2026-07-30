-- 여행 일정 항목에 장소(구글 지도 연동) 컬럼 추가
-- Supabase SQL Editor에서 실행

ALTER TABLE travel_abroad_itinerary_items
  ADD COLUMN IF NOT EXISTS place_name TEXT,
  ADD COLUMN IF NOT EXISTS place_address TEXT,
  ADD COLUMN IF NOT EXISTS place_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS place_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT;

COMMENT ON COLUMN travel_abroad_itinerary_items.place_name IS '일정 장소명';
COMMENT ON COLUMN travel_abroad_itinerary_items.place_address IS '일정 장소 주소';
COMMENT ON COLUMN travel_abroad_itinerary_items.place_lat IS '장소 위도 (선택)';
COMMENT ON COLUMN travel_abroad_itinerary_items.place_lng IS '장소 경도 (선택)';
COMMENT ON COLUMN travel_abroad_itinerary_items.google_place_id IS 'Google Place ID (선택, Places API 사용 시)';
