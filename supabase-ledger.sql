-- 가계부 테이블 + RLS
-- Supabase SQL Editor에서 실행
-- 이미 테이블이 있어도 누락 컬럼을 보강합니다 (IF NOT EXISTS)

-- 카테고리
CREATE TABLE IF NOT EXISTS ledger_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_category_id UUID REFERENCES ledger_categories (id) ON DELETE SET NULL,
  fixed_cost_yn BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ledger_categories ADD COLUMN IF NOT EXISTS parent_category_id UUID REFERENCES ledger_categories (id) ON DELETE SET NULL;
ALTER TABLE ledger_categories ADD COLUMN IF NOT EXISTS fixed_cost_yn BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ledger_categories ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ledger_categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE ledger_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS ledger_categories_user_id_idx ON ledger_categories (user_id);
CREATE INDEX IF NOT EXISTS ledger_categories_user_type_idx ON ledger_categories (user_id, type);

-- 기존 중복 카테고리 정리 (같은 user_id + type + name 중 id가 더 작은 것만 유지)
DELETE FROM ledger_categories a
USING ledger_categories b
WHERE a.user_id = b.user_id
  AND a.type = b.type
  AND a.name = b.name
  AND a.id::text > b.id::text;

-- 동일 사용자·유형·이름 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS ledger_categories_user_type_name_uidx
  ON ledger_categories (user_id, type, name);

-- 계좌
CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KRW',
  balance NUMERIC NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ledger_accounts ADD COLUMN IF NOT EXISTS balance NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE ledger_accounts ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'KRW';
ALTER TABLE ledger_accounts ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ledger_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE ledger_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS ledger_accounts_user_id_idx ON ledger_accounts (user_id);

-- 거래
CREATE TABLE IF NOT EXISTS ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category_id UUID REFERENCES ledger_categories (id) ON DELETE SET NULL,
  account_id UUID REFERENCES ledger_accounts (id) ON DELETE SET NULL,
  to_account_id UUID REFERENCES ledger_accounts (id) ON DELETE SET NULL,
  payment_method TEXT,
  transaction_date TEXT NOT NULL DEFAULT '',
  memo TEXT,
  fixed_cost_yn BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 테이블에 누락된 컬럼 보강 (가장 흔한 오류 원인)
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES ledger_categories (id) ON DELETE SET NULL;
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES ledger_accounts (id) ON DELETE SET NULL;
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS to_account_id UUID REFERENCES ledger_accounts (id) ON DELETE SET NULL;
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS transaction_date TEXT NOT NULL DEFAULT '';
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS memo TEXT;
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS fixed_cost_yn BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE ledger_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 예전 컬럼명(date 등)이 있고 transaction_date가 비어 있으면 이전
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ledger_transactions'
      AND column_name = 'date'
  ) THEN
    UPDATE ledger_transactions
    SET transaction_date = date
    WHERE (transaction_date IS NULL OR transaction_date = '')
      AND date IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ledger_transactions_user_id_idx ON ledger_transactions (user_id);
CREATE INDEX IF NOT EXISTS ledger_transactions_user_date_idx ON ledger_transactions (user_id, transaction_date);
CREATE INDEX IF NOT EXISTS ledger_transactions_user_type_idx ON ledger_transactions (user_id, type);

-- 투자
CREATE TABLE IF NOT EXISTS ledger_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KRW',
  source_symbol TEXT,
  quantity NUMERIC DEFAULT 0,
  avg_price NUMERIC DEFAULT 0,
  current_price NUMERIC DEFAULT 0,
  invested_amount NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ledger_investments ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
ALTER TABLE ledger_investments ADD COLUMN IF NOT EXISTS avg_price NUMERIC DEFAULT 0;
ALTER TABLE ledger_investments ADD COLUMN IF NOT EXISTS current_price NUMERIC DEFAULT 0;
ALTER TABLE ledger_investments ADD COLUMN IF NOT EXISTS invested_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE ledger_investments ADD COLUMN IF NOT EXISTS current_value NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE ledger_investments ADD COLUMN IF NOT EXISTS source_symbol TEXT;
ALTER TABLE ledger_investments ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE ledger_investments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE ledger_investments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 기존 해외주식은 달러로 저장되어 있었음 (currency가 NULL인 행만 채움)
UPDATE ledger_investments
SET currency = CASE
  WHEN asset_type = 'OVERSEAS_STOCK' THEN 'USD'
  ELSE 'KRW'
END
WHERE currency IS NULL;

ALTER TABLE ledger_investments ALTER COLUMN currency SET DEFAULT 'KRW';
UPDATE ledger_investments SET currency = 'KRW' WHERE currency IS NULL;
ALTER TABLE ledger_investments ALTER COLUMN currency SET NOT NULL;

CREATE INDEX IF NOT EXISTS ledger_investments_user_id_idx ON ledger_investments (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_investments_user_source_symbol_uidx
  ON ledger_investments (user_id, source_symbol)
  WHERE source_symbol IS NOT NULL;

-- 순자산 스냅샷 (그래프용 예약)
CREATE TABLE IF NOT EXISTS ledger_net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  snapshot_date TEXT NOT NULL,
  total_assets NUMERIC NOT NULL DEFAULT 0,
  total_liabilities NUMERIC NOT NULL DEFAULT 0,
  net_worth NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ledger_net_worth_snapshots ADD COLUMN IF NOT EXISTS total_assets NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE ledger_net_worth_snapshots ADD COLUMN IF NOT EXISTS total_liabilities NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE ledger_net_worth_snapshots ADD COLUMN IF NOT EXISTS net_worth NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE ledger_net_worth_snapshots ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS ledger_net_worth_snapshots_user_date_idx
  ON ledger_net_worth_snapshots (user_id, snapshot_date);

-- RLS
ALTER TABLE ledger_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_net_worth_snapshots ENABLE ROW LEVEL SECURITY;

-- ledger_categories policies
DROP POLICY IF EXISTS "ledger_categories_select_own" ON ledger_categories;
CREATE POLICY "ledger_categories_select_own" ON ledger_categories
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_categories_insert_own" ON ledger_categories;
CREATE POLICY "ledger_categories_insert_own" ON ledger_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_categories_update_own" ON ledger_categories;
CREATE POLICY "ledger_categories_update_own" ON ledger_categories
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_categories_delete_own" ON ledger_categories;
CREATE POLICY "ledger_categories_delete_own" ON ledger_categories
  FOR DELETE USING (auth.uid() = user_id);

-- ledger_accounts policies
DROP POLICY IF EXISTS "ledger_accounts_select_own" ON ledger_accounts;
CREATE POLICY "ledger_accounts_select_own" ON ledger_accounts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_accounts_insert_own" ON ledger_accounts;
CREATE POLICY "ledger_accounts_insert_own" ON ledger_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_accounts_update_own" ON ledger_accounts;
CREATE POLICY "ledger_accounts_update_own" ON ledger_accounts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_accounts_delete_own" ON ledger_accounts;
CREATE POLICY "ledger_accounts_delete_own" ON ledger_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- ledger_transactions policies
DROP POLICY IF EXISTS "ledger_transactions_select_own" ON ledger_transactions;
CREATE POLICY "ledger_transactions_select_own" ON ledger_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_transactions_insert_own" ON ledger_transactions;
CREATE POLICY "ledger_transactions_insert_own" ON ledger_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_transactions_update_own" ON ledger_transactions;
CREATE POLICY "ledger_transactions_update_own" ON ledger_transactions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_transactions_delete_own" ON ledger_transactions;
CREATE POLICY "ledger_transactions_delete_own" ON ledger_transactions
  FOR DELETE USING (auth.uid() = user_id);

-- ledger_investments policies
DROP POLICY IF EXISTS "ledger_investments_select_own" ON ledger_investments;
CREATE POLICY "ledger_investments_select_own" ON ledger_investments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_investments_insert_own" ON ledger_investments;
CREATE POLICY "ledger_investments_insert_own" ON ledger_investments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_investments_update_own" ON ledger_investments;
CREATE POLICY "ledger_investments_update_own" ON ledger_investments
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_investments_delete_own" ON ledger_investments;
CREATE POLICY "ledger_investments_delete_own" ON ledger_investments
  FOR DELETE USING (auth.uid() = user_id);

-- ledger_net_worth_snapshots policies
DROP POLICY IF EXISTS "ledger_net_worth_snapshots_select_own" ON ledger_net_worth_snapshots;
CREATE POLICY "ledger_net_worth_snapshots_select_own" ON ledger_net_worth_snapshots
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_net_worth_snapshots_insert_own" ON ledger_net_worth_snapshots;
CREATE POLICY "ledger_net_worth_snapshots_insert_own" ON ledger_net_worth_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_net_worth_snapshots_update_own" ON ledger_net_worth_snapshots;
CREATE POLICY "ledger_net_worth_snapshots_update_own" ON ledger_net_worth_snapshots
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ledger_net_worth_snapshots_delete_own" ON ledger_net_worth_snapshots;
CREATE POLICY "ledger_net_worth_snapshots_delete_own" ON ledger_net_worth_snapshots
  FOR DELETE USING (auth.uid() = user_id);
