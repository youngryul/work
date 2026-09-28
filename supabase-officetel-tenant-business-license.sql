-- 오피스텔 임차인 이메일 + 사업자등록증 파일 첨부
-- 사업자등록증은 민감 문서이므로 비공개 버킷에 '{user_id}/...' 경로로 저장하고 서명 URL로만 조회

ALTER TABLE officetel_tenants ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE officetel_tenants ADD COLUMN IF NOT EXISTS business_license_path text;
ALTER TABLE officetel_tenants ADD COLUMN IF NOT EXISTS business_license_name text;

-- 비공개 Storage 버킷 (최대 10MB, 이미지/PDF만 허용)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'officetel-documents',
  'officetel-documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 본인 폴더({user_id}/...)의 파일만 조회·업로드·수정·삭제 가능
DROP POLICY IF EXISTS "officetel-documents: 본인 조회" ON storage.objects;
CREATE POLICY "officetel-documents: 본인 조회" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'officetel-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "officetel-documents: 본인 업로드" ON storage.objects;
CREATE POLICY "officetel-documents: 본인 업로드" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'officetel-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "officetel-documents: 본인 수정" ON storage.objects;
CREATE POLICY "officetel-documents: 본인 수정" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'officetel-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "officetel-documents: 본인 삭제" ON storage.objects;
CREATE POLICY "officetel-documents: 본인 삭제" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'officetel-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
