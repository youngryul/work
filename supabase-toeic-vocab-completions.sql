-- 토익 단어 Day별 완료 횟수 / 챌린지 목표

CREATE TABLE IF NOT EXISTS toeic_vocab_day_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number > 0),
  completion_count INTEGER NOT NULL DEFAULT 0 CHECK (completion_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, day_number)
);

CREATE TABLE IF NOT EXISTS toeic_vocab_challenge_goals (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  goal TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toeic_vocab_day_completions_user
  ON toeic_vocab_day_completions (user_id);

ALTER TABLE toeic_vocab_day_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE toeic_vocab_challenge_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_toeic_day_completions" ON toeic_vocab_day_completions;
CREATE POLICY "users_select_own_toeic_day_completions" ON toeic_vocab_day_completions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_toeic_day_completions" ON toeic_vocab_day_completions;
CREATE POLICY "users_insert_own_toeic_day_completions" ON toeic_vocab_day_completions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_toeic_day_completions" ON toeic_vocab_day_completions;
CREATE POLICY "users_update_own_toeic_day_completions" ON toeic_vocab_day_completions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_toeic_day_completions" ON toeic_vocab_day_completions;
CREATE POLICY "users_delete_own_toeic_day_completions" ON toeic_vocab_day_completions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_select_own_toeic_challenge_goals" ON toeic_vocab_challenge_goals;
CREATE POLICY "users_select_own_toeic_challenge_goals" ON toeic_vocab_challenge_goals
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_toeic_challenge_goals" ON toeic_vocab_challenge_goals;
CREATE POLICY "users_insert_own_toeic_challenge_goals" ON toeic_vocab_challenge_goals
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_toeic_challenge_goals" ON toeic_vocab_challenge_goals;
CREATE POLICY "users_update_own_toeic_challenge_goals" ON toeic_vocab_challenge_goals
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_toeic_challenge_goals" ON toeic_vocab_challenge_goals;
CREATE POLICY "users_delete_own_toeic_challenge_goals" ON toeic_vocab_challenge_goals
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
