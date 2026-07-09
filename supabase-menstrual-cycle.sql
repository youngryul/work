-- 생리 일정 관리 (일정 달력 연동)

CREATE TABLE IF NOT EXISTS menstrual_cycle_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_length INTEGER NOT NULL DEFAULT 28 CHECK (cycle_length BETWEEN 21 AND 45),
  period_length INTEGER NOT NULL DEFAULT 5 CHECK (period_length BETWEEN 2 AND 10),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE menstrual_cycle_settings
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE menstrual_cycle_settings
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS menstrual_period_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date),
  UNIQUE (user_id, start_date)
);

CREATE INDEX IF NOT EXISTS idx_menstrual_period_records_user_dates
  ON menstrual_period_records (user_id, start_date DESC);

ALTER TABLE menstrual_cycle_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE menstrual_period_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_menstrual_cycle_settings" ON menstrual_cycle_settings;
CREATE POLICY "users_select_own_menstrual_cycle_settings" ON menstrual_cycle_settings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_menstrual_cycle_settings" ON menstrual_cycle_settings;
CREATE POLICY "users_insert_own_menstrual_cycle_settings" ON menstrual_cycle_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_menstrual_cycle_settings" ON menstrual_cycle_settings;
CREATE POLICY "users_update_own_menstrual_cycle_settings" ON menstrual_cycle_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_menstrual_cycle_settings" ON menstrual_cycle_settings;
CREATE POLICY "users_delete_own_menstrual_cycle_settings" ON menstrual_cycle_settings
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_select_own_menstrual_period_records" ON menstrual_period_records;
CREATE POLICY "users_select_own_menstrual_period_records" ON menstrual_period_records
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_menstrual_period_records" ON menstrual_period_records;
CREATE POLICY "users_insert_own_menstrual_period_records" ON menstrual_period_records
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_menstrual_period_records" ON menstrual_period_records;
CREATE POLICY "users_update_own_menstrual_period_records" ON menstrual_period_records
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_menstrual_period_records" ON menstrual_period_records;
CREATE POLICY "users_delete_own_menstrual_period_records" ON menstrual_period_records
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
