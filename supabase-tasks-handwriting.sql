-- 할 일 손글씨: iOS 앱에서 손글씨로 작성한 할 일의 이미지 URL
-- (title에는 손글씨 인식 결과가 저장되어 검색·알림·위젯에 사용)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS handwriting_image_url text;

COMMENT ON COLUMN tasks.handwriting_image_url IS '손글씨로 작성한 할 일의 이미지 URL (없으면 제목을 폰트로 표시)';
