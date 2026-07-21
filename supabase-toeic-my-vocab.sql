-- 나만의 토익 단어장 (계정별)
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS toeic_my_vocab_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  en TEXT NOT NULL,
  ko TEXT NOT NULL,
  checks INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS toeic_my_vocab_words_user_id_idx ON toeic_my_vocab_words (user_id);
CREATE INDEX IF NOT EXISTS toeic_my_vocab_words_user_sort_idx ON toeic_my_vocab_words (user_id, sort_order, created_at);

ALTER TABLE toeic_my_vocab_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "toeic_my_vocab_select_own" ON toeic_my_vocab_words;
CREATE POLICY "toeic_my_vocab_select_own" ON toeic_my_vocab_words
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "toeic_my_vocab_insert_own" ON toeic_my_vocab_words;
CREATE POLICY "toeic_my_vocab_insert_own" ON toeic_my_vocab_words
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "toeic_my_vocab_update_own" ON toeic_my_vocab_words;
CREATE POLICY "toeic_my_vocab_update_own" ON toeic_my_vocab_words
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "toeic_my_vocab_delete_own" ON toeic_my_vocab_words;
CREATE POLICY "toeic_my_vocab_delete_own" ON toeic_my_vocab_words
  FOR DELETE USING (auth.uid() = user_id);
