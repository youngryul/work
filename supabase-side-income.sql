-- 부수입(월급 이외 수입) 테이블 + RLS
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS side_incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  income_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT NOT NULL,                 -- 내역 (예: 블로그 광고 수익)
  amount BIGINT NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS side_incomes_user_date_idx ON side_incomes (user_id, income_date);

-- RLS 활성화
ALTER TABLE side_incomes ENABLE ROW LEVEL SECURITY;

-- 본인만 CRUD 가능
DROP POLICY IF EXISTS "side_incomes: 본인만 CRUD" ON side_incomes;
CREATE POLICY "side_incomes: 본인만 CRUD" ON side_incomes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at 자동 갱신 트리거 함수 (없을 경우 생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS side_incomes_updated_at ON side_incomes;
CREATE TRIGGER side_incomes_updated_at
  BEFORE UPDATE ON side_incomes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
