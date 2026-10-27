-- 필기 노트 (굿노트형 손글씨 노트)
-- iOS 앱에서 PencilKit으로 필기하고, 웹에서는 미리보기 이미지로 보기만 한다.
-- Supabase SQL Editor에서 실행

-- 노트북
CREATE TABLE IF NOT EXISTS notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  cover_color text NOT NULL DEFAULT 'green',
  -- 새 페이지의 기본 속지 (blank | lined | grid | dot)
  paper_type text NOT NULL DEFAULT 'lined' CHECK (paper_type IN ('blank', 'lined', 'grid', 'dot')),
  -- PDF를 가져와 만든 노트면 원본 PDF의 Storage 경로 (notebooks 버킷)
  pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 노트 페이지
CREATE TABLE IF NOT EXISTS notebook_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 페이지 순서 (중간 삽입 시 앞뒤 값의 평균을 사용해 다른 페이지를 고치지 않는다)
  page_order double precision NOT NULL DEFAULT 0,
  -- blank | lined | grid | dot | pdf
  paper_type text NOT NULL DEFAULT 'lined' CHECK (paper_type IN ('blank', 'lined', 'grid', 'dot', 'pdf')),
  -- paper_type = 'pdf'일 때 원본 PDF의 페이지 번호 (0부터)
  pdf_page_index integer,
  -- PencilKit 획 데이터 (PKDrawing.dataRepresentation) Storage 경로
  drawing_path text,
  -- 속지·사진·필기를 합친 미리보기 JPEG Storage 경로 (목록·웹 보기용)
  preview_path text,
  -- 붙인 사진 [{ id, path, x, y, width, height }] (좌표는 페이지 기준 pt)
  images jsonb NOT NULL DEFAULT '[]',
  -- 손글씨 인식 결과 (검색용)
  recognized_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: 본인만 CRUD
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notebooks: 본인만 CRUD" ON notebooks;
CREATE POLICY "notebooks: 본인만 CRUD" ON notebooks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notebook_pages: 본인만 CRUD" ON notebook_pages;
CREATE POLICY "notebook_pages: 본인만 CRUD" ON notebook_pages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notebooks_user ON notebooks(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notebook_pages_notebook ON notebook_pages(notebook_id, page_order);
CREATE INDEX IF NOT EXISTS idx_notebook_pages_user ON notebook_pages(user_id);

-- updated_at 자동 갱신 (함수는 supabase-graduate-notes.sql과 동일)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notebooks_updated_at ON notebooks;
CREATE TRIGGER notebooks_updated_at
  BEFORE UPDATE ON notebooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS notebook_pages_updated_at ON notebook_pages;
CREATE TRIGGER notebook_pages_updated_at
  BEFORE UPDATE ON notebook_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 페이지가 바뀌면 노트북 updated_at도 갱신 (목록 정렬용)
CREATE OR REPLACE FUNCTION touch_notebook_from_page()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE notebooks SET updated_at = now()
  WHERE id = COALESCE(NEW.notebook_id, OLD.notebook_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notebook_pages_touch_notebook ON notebook_pages;
CREATE TRIGGER notebook_pages_touch_notebook
  AFTER INSERT OR UPDATE OR DELETE ON notebook_pages
  FOR EACH ROW
  EXECUTE FUNCTION touch_notebook_from_page();

-- Storage: 비공개 notebooks 버킷 (경로: {user_id}/{notebook_id}/...)
-- 필기 원본·PDF가 들어가므로 공개 버킷(images)이 아닌 비공개 버킷을 쓴다.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('notebooks', 'notebooks', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "notebooks 버킷: 본인 폴더 읽기" ON storage.objects;
CREATE POLICY "notebooks 버킷: 본인 폴더 읽기" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'notebooks' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "notebooks 버킷: 본인 폴더 업로드" ON storage.objects;
CREATE POLICY "notebooks 버킷: 본인 폴더 업로드" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notebooks' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "notebooks 버킷: 본인 폴더 수정" ON storage.objects;
CREATE POLICY "notebooks 버킷: 본인 폴더 수정" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'notebooks' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "notebooks 버킷: 본인 폴더 삭제" ON storage.objects;
CREATE POLICY "notebooks 버킷: 본인 폴더 삭제" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'notebooks' AND (storage.foldername(name))[1] = auth.uid()::text);
