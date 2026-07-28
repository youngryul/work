-- 여행 기념품 사진 첨부용 컬럼 추가
-- Supabase SQL Editor에서 실행

ALTER TABLE travel_abroad_souvenir_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN travel_abroad_souvenir_items.image_url IS '기념품 사진 URL (Supabase Storage public URL)';
