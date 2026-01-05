-- 일기 테이블에 첨부 이미지 필드 추가

-- attached_images 컬럼 추가 (JSON 배열로 여러 이미지 URL 저장)
ALTER TABLE diaries 
ADD COLUMN IF NOT EXISTS attached_images JSONB DEFAULT '[]'::jsonb;

