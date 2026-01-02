-- tasks 테이블에 images 필드 추가 (이미지 URL 배열)
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- 인덱스는 필요 없음 (배열 필드는 일반적으로 인덱싱하지 않음)

