-- 사진 4컷 스트립을 AI 4컷과 분리 저장하기 위한 컬럼 추가
-- AI 4컷: four_cut_url + four_cut_scene_urls
-- 사진 4컷: photo_four_cut_url + attached_images
ALTER TABLE diaries
  ADD COLUMN IF NOT EXISTS photo_four_cut_url text;

COMMENT ON COLUMN diaries.photo_four_cut_url IS '사진 4컷 합성 스트립 공개 URL (원본 사진은 attached_images)';
COMMENT ON COLUMN diaries.four_cut_url IS 'AI 4컷 합성 스트립 공개 URL';
COMMENT ON COLUMN diaries.four_cut_scene_urls IS 'AI 4컷 개별 장면 URL 배열 (최대 4)';

-- 기존 데이터 이전: 사진 4컷으로 저장돼 four_cut_* 컬럼을 차지하던 행을 분리
UPDATE diaries
SET photo_four_cut_url = four_cut_url,
    four_cut_url = NULL,
    four_cut_scene_urls = '[]'::jsonb
WHERE photo_four_cut_url IS NULL
  AND four_cut_url IS NOT NULL
  AND jsonb_array_length(COALESCE(to_jsonb(attached_images), '[]'::jsonb)) > 0
  AND four_cut_scene_urls = to_jsonb(attached_images);
