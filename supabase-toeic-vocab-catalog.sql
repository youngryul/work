-- 토익 노랭이 단어 카탈로그 (앱 공통, 읽기 전용)
-- Supabase SQL Editor에서 실행 후 scripts/seed-toeic-vocab-catalog.mjs 로 초기 데이터 업로드

CREATE TABLE IF NOT EXISTS toeic_vocab_catalog (
  sort_order INTEGER NOT NULL PRIMARY KEY,
  en TEXT NOT NULL,
  ko TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS toeic_vocab_catalog_sort_idx ON toeic_vocab_catalog (sort_order);

ALTER TABLE toeic_vocab_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "toeic_vocab_catalog_select_authenticated" ON toeic_vocab_catalog;
CREATE POLICY "toeic_vocab_catalog_select_authenticated" ON toeic_vocab_catalog
  FOR SELECT TO authenticated
  USING (true);
