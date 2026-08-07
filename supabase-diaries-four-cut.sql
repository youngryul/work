-- diaries 테이블에 4컷·대문 이미지 관련 컬럼 추가
ALTER TABLE diaries
  ADD COLUMN IF NOT EXISTS four_cut_url text;

ALTER TABLE diaries
  ADD COLUMN IF NOT EXISTS four_cut_scene_urls jsonb DEFAULT '[]'::jsonb;

ALTER TABLE diaries
  ADD COLUMN IF NOT EXISTS cover_image_url text;

COMMENT ON COLUMN diaries.four_cut_url IS '사진/AI 4컷 합성 스트립 공개 URL';
COMMENT ON COLUMN diaries.four_cut_scene_urls IS 'AI/사진 4컷 개별 장면 URL 배열 (최대 4)';
COMMENT ON COLUMN diaries.cover_image_url IS '달력 대문으로 선택한 이미지 URL';
