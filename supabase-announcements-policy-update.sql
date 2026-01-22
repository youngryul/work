-- 공지사항 조회 정책 업데이트
-- 모든 인증된 사용자가 활성화된 공지사항을 조회할 수 있도록 보장

-- 기존 정책 제거
DROP POLICY IF EXISTS "Authenticated users can view active announcements" ON announcements;

-- 모든 인증된 사용자가 활성화된 공지사항 조회 가능
CREATE POLICY "Authenticated users can view active announcements" ON announcements
  FOR SELECT 
  USING (
    auth.role() = 'authenticated' 
    AND is_active = TRUE 
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- 정책이 제대로 적용되었는지 확인
-- SELECT * FROM announcements; -- 인증된 사용자로 테스트
