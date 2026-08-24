-- 여행 앨범 기간 컬럼
-- Supabase SQL Editor에서 실행

ALTER TABLE travel_albums
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- 일정과 연동된 앨범은 출국·귀국일로 채움
UPDATE travel_albums a
SET
  start_date = (t.departure_at AT TIME ZONE 'Asia/Seoul')::date,
  end_date = (t.return_at AT TIME ZONE 'Asia/Seoul')::date
FROM travel_abroad_trips t
WHERE a.trip_id = t.id
  AND a.start_date IS NULL;

COMMENT ON COLUMN travel_albums.start_date IS '여행 시작일';
COMMENT ON COLUMN travel_albums.end_date IS '여행 종료일';
