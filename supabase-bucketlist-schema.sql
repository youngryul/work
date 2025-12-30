-- 버킷리스트 관리 서비스 데이터베이스 스키마

-- 1. 버킷리스트 테이블
CREATE TABLE IF NOT EXISTS bucketlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- 향후 사용자 인증 추가 시 사용 (현재는 임시로 사용)
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('TRAVEL', 'CAREER', 'HEALTH', 'RELATIONSHIP', 'HOBBY', 'LEARNING', 'FINANCIAL', 'EXPERIENCE')),
  status TEXT NOT NULL DEFAULT 'NOT_COMPLETED' CHECK (status IN ('NOT_COMPLETED', 'COMPLETED')),
  target_date DATE, -- 목표 날짜 (선택사항)
  completed_at TIMESTAMP WITH TIME ZONE, -- 완료 시점
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. 버킷리스트 회고 테이블
CREATE TABLE IF NOT EXISTS bucketlist_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucketlist_id UUID NOT NULL REFERENCES bucketlists(id) ON DELETE CASCADE,
  reflection_text TEXT NOT NULL, -- 회고 내용
  achievement_score INTEGER CHECK (achievement_score >= 1 AND achievement_score <= 10), -- 성취감 점수 (1-10)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_bucketlists_user_id ON bucketlists(user_id);
CREATE INDEX IF NOT EXISTS idx_bucketlists_status ON bucketlists(status);
CREATE INDEX IF NOT EXISTS idx_bucketlists_category ON bucketlists(category);
CREATE INDEX IF NOT EXISTS idx_bucketlists_completed_at ON bucketlists(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bucketlists_created_at ON bucketlists(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bucketlist_reflections_bucketlist_id ON bucketlist_reflections(bucketlist_id);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_bucketlist_updatedat()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_bucketlists_updatedat
  BEFORE UPDATE ON bucketlists
  FOR EACH ROW
  EXECUTE FUNCTION update_bucketlist_updatedat();

CREATE TRIGGER update_bucketlist_reflections_updatedat
  BEFORE UPDATE ON bucketlist_reflections
  FOR EACH ROW
  EXECUTE FUNCTION update_bucketlist_updatedat();

