-- 국내여행 기록 시스템 데이터베이스 스키마

-- 1. 여행 기본 정보 테이블
CREATE TABLE IF NOT EXISTS travels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  province TEXT NOT NULL, -- 시/도
  city TEXT, -- 시/군/구
  companion_type TEXT NOT NULL DEFAULT 'ALONE' CHECK (companion_type IN ('ALONE', 'FRIENDS', 'FAMILY', 'COUPLE', 'OTHER')),
  satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5), -- 만족도 (1-5점)
  one_line_review TEXT, -- 한줄 회고
  is_public BOOLEAN DEFAULT false, -- 공개/비공개
  is_favorite BOOLEAN DEFAULT false, -- 즐겨찾기
  representative_image_url TEXT, -- 대표 사진 URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CHECK (end_date >= start_date)
);

-- 2. 여행 목적 태그 테이블
CREATE TABLE IF NOT EXISTS travel_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(travel_id, tag)
);

-- 3. 방문 장소 테이블
CREATE TABLE IF NOT EXISTS travel_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('RESTAURANT', 'ATTRACTION', 'ACCOMMODATION', 'SHOPPING', 'CAFE', 'OTHER')),
  address TEXT,
  latitude DECIMAL(10, 8), -- 위도
  longitude DECIMAL(11, 8), -- 경도
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 평점 (1-5점)
  memo TEXT, -- 장소별 메모
  visit_date DATE, -- 방문 날짜
  visit_time TIMESTAMP WITH TIME ZONE, -- 방문 시간
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. 날짜별 기록 테이블
CREATE TABLE IF NOT EXISTS travel_date_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  content TEXT, -- 텍스트 기록
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(travel_id, record_date)
);

-- 5. 장소별 기록 테이블
CREATE TABLE IF NOT EXISTS travel_place_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  place_id UUID REFERENCES travel_places(id) ON DELETE SET NULL,
  content TEXT, -- 텍스트 기록
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. 여행 사진 테이블
CREATE TABLE IF NOT EXISTS travel_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  date_record_id UUID REFERENCES travel_date_records(id) ON DELETE CASCADE,
  place_id UUID REFERENCES travel_places(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_order INTEGER DEFAULT 0, -- 사진 순서
  is_representative BOOLEAN DEFAULT false, -- 대표 사진 여부
  caption TEXT, -- 사진 설명
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 7. 감정 태그 테이블
CREATE TABLE IF NOT EXISTS travel_emotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_id UUID NOT NULL REFERENCES travels(id) ON DELETE CASCADE,
  emotion TEXT NOT NULL, -- 감정 태그 (예: '행복', '평온', '설렘' 등)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(travel_id, emotion)
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_travels_user_id ON travels(user_id);
CREATE INDEX IF NOT EXISTS idx_travels_start_date ON travels(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_travels_end_date ON travels(end_date DESC);
CREATE INDEX IF NOT EXISTS idx_travels_province ON travels(province);
CREATE INDEX IF NOT EXISTS idx_travels_city ON travels(city);
CREATE INDEX IF NOT EXISTS idx_travels_is_public ON travels(is_public);
CREATE INDEX IF NOT EXISTS idx_travels_is_favorite ON travels(is_favorite);
CREATE INDEX IF NOT EXISTS idx_travels_created_at ON travels(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_travel_tags_travel_id ON travel_tags(travel_id);
CREATE INDEX IF NOT EXISTS idx_travel_tags_tag ON travel_tags(tag);

CREATE INDEX IF NOT EXISTS idx_travel_places_travel_id ON travel_places(travel_id);
CREATE INDEX IF NOT EXISTS idx_travel_places_category ON travel_places(category);
CREATE INDEX IF NOT EXISTS idx_travel_places_visit_date ON travel_places(visit_date);
CREATE INDEX IF NOT EXISTS idx_travel_places_location ON travel_places(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_travel_date_records_travel_id ON travel_date_records(travel_id);
CREATE INDEX IF NOT EXISTS idx_travel_date_records_record_date ON travel_date_records(record_date);

CREATE INDEX IF NOT EXISTS idx_travel_place_records_travel_id ON travel_place_records(travel_id);
CREATE INDEX IF NOT EXISTS idx_travel_place_records_place_id ON travel_place_records(place_id);

CREATE INDEX IF NOT EXISTS idx_travel_images_travel_id ON travel_images(travel_id);
CREATE INDEX IF NOT EXISTS idx_travel_images_date_record_id ON travel_images(date_record_id);
CREATE INDEX IF NOT EXISTS idx_travel_images_place_id ON travel_images(place_id);
CREATE INDEX IF NOT EXISTS idx_travel_images_is_representative ON travel_images(is_representative);

CREATE INDEX IF NOT EXISTS idx_travel_emotions_travel_id ON travel_emotions(travel_id);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_travel_updatedat()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_travels_updatedat
  BEFORE UPDATE ON travels
  FOR EACH ROW
  EXECUTE FUNCTION update_travel_updatedat();

CREATE TRIGGER update_travel_places_updatedat
  BEFORE UPDATE ON travel_places
  FOR EACH ROW
  EXECUTE FUNCTION update_travel_updatedat();

CREATE TRIGGER update_travel_date_records_updatedat
  BEFORE UPDATE ON travel_date_records
  FOR EACH ROW
  EXECUTE FUNCTION update_travel_updatedat();

CREATE TRIGGER update_travel_place_records_updatedat
  BEFORE UPDATE ON travel_place_records
  FOR EACH ROW
  EXECUTE FUNCTION update_travel_updatedat();

-- Row Level Security (RLS) 정책
ALTER TABLE travels ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_date_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_place_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_emotions ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 여행만 조회/수정/삭제 가능
CREATE POLICY "Users can view their own travels" ON travels
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own travels" ON travels
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own travels" ON travels
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own travels" ON travels
  FOR DELETE
  USING (auth.uid() = user_id);

-- 공개 여행은 모든 사용자가 조회 가능
CREATE POLICY "Users can view public travels" ON travels
  FOR SELECT
  USING (is_public = true);

-- 여행 태그 정책
CREATE POLICY "Users can manage tags for their travels" ON travel_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_tags.travel_id
      AND travels.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_tags.travel_id
      AND travels.user_id = auth.uid()
    )
  );

-- 장소 정책
CREATE POLICY "Users can manage places for their travels" ON travel_places
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_places.travel_id
      AND travels.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_places.travel_id
      AND travels.user_id = auth.uid()
    )
  );

-- 날짜별 기록 정책
CREATE POLICY "Users can manage date records for their travels" ON travel_date_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_date_records.travel_id
      AND travels.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_date_records.travel_id
      AND travels.user_id = auth.uid()
    )
  );

-- 장소별 기록 정책
CREATE POLICY "Users can manage place records for their travels" ON travel_place_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_place_records.travel_id
      AND travels.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_place_records.travel_id
      AND travels.user_id = auth.uid()
    )
  );

-- 사진 정책
CREATE POLICY "Users can manage images for their travels" ON travel_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_images.travel_id
      AND travels.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_images.travel_id
      AND travels.user_id = auth.uid()
    )
  );

-- 감정 태그 정책
CREATE POLICY "Users can manage emotions for their travels" ON travel_emotions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_emotions.travel_id
      AND travels.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM travels
      WHERE travels.id = travel_emotions.travel_id
      AND travels.user_id = auth.uid()
    )
  );
