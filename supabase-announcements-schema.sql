-- 공지사항 테이블 생성
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  version TEXT, -- 배포 버전 (예: "1.2.3", "2024-01-15")
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0, -- 우선순위 (높을수록 먼저 표시)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE -- 만료일 (NULL이면 만료되지 않음)
);

-- 사용자가 본 공지사항 기록 테이블
CREATE TABLE IF NOT EXISTS announcement_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, announcement_id) -- 같은 공지사항을 중복 기록 방지
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_announcement_views_user_id ON announcement_views(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_announcement_id ON announcement_views(announcement_id);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_announcements_updatedat()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_announcements_updatedat
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcements_updatedat();

-- RLS (Row Level Security) 정책 설정
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_views ENABLE ROW LEVEL SECURITY;

-- 공지사항 조회 정책 (모든 인증된 사용자가 활성화된 공지사항 조회 가능)
DROP POLICY IF EXISTS "Authenticated users can view active announcements" ON announcements;
CREATE POLICY "Authenticated users can view active announcements" ON announcements
  FOR SELECT USING (
    auth.role() = 'authenticated' 
    AND is_active = TRUE 
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- 공지사항 조회 기록 정책 (사용자는 자신의 조회 기록만 조회/생성 가능)
DROP POLICY IF EXISTS "Users can view own announcement views" ON announcement_views;
DROP POLICY IF EXISTS "Users can insert own announcement views" ON announcement_views;

CREATE POLICY "Users can view own announcement views" ON announcement_views
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own announcement views" ON announcement_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);
