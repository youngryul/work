-- Supabase Storage 버킷 생성 및 정책 설정
-- 
-- 주의: Supabase 대시보드에서 Storage > Create a new bucket으로 먼저 버킷을 생성해야 합니다.
-- 버킷 이름: images
-- Public bucket: 체크 (공개 접근 허용)
--
-- 버킷 생성 후 아래 정책을 SQL Editor에서 실행하세요.

-- 1. 공개 읽기 정책 (이미지 URL 접근 허용)
-- 기존 정책이 있으면 삭제 후 생성
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT
USING (bucket_id = 'images');

-- 2. 업로드 정책 (모든 사용자가 업로드 가능)
-- 개인 프로젝트이므로 인증 없이도 업로드 가능하도록 설정
DROP POLICY IF EXISTS "Allow uploads" ON storage.objects;
CREATE POLICY "Allow uploads" ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'images');

-- 3. 삭제 정책 (모든 사용자가 삭제 가능)
DROP POLICY IF EXISTS "Allow deletes" ON storage.objects;
CREATE POLICY "Allow deletes" ON storage.objects
FOR DELETE
USING (bucket_id = 'images');
