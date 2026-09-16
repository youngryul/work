-- 오피스텔 매매 기록 테이블
-- 매물별 총 비용, 분담 내역(누가 얼마 냈는지), 기타 비용(복비/법무사비 등) 기록

CREATE TABLE IF NOT EXISTS officetel_purchase_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_name text NOT NULL,
  address text,
  purchase_date date,
  sale_price numeric(14, 0) NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 분담 내역 (누가 얼마 냈는지)
CREATE TABLE IF NOT EXISTS officetel_purchase_payers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES officetel_purchase_records(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payer_name text NOT NULL,
  amount numeric(14, 0) NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 기타 비용 (중개수수료(복비), 법무사비, 취득세 등)
CREATE TABLE IF NOT EXISTS officetel_purchase_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES officetel_purchase_records(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric(14, 0) NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE officetel_purchase_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE officetel_purchase_payers ENABLE ROW LEVEL SECURITY;
ALTER TABLE officetel_purchase_costs ENABLE ROW LEVEL SECURITY;

-- 본인만 CRUD 가능
DROP POLICY IF EXISTS "officetel_purchase_records: 본인만 CRUD" ON officetel_purchase_records;
CREATE POLICY "officetel_purchase_records: 본인만 CRUD" ON officetel_purchase_records
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "officetel_purchase_payers: 본인만 CRUD" ON officetel_purchase_payers;
CREATE POLICY "officetel_purchase_payers: 본인만 CRUD" ON officetel_purchase_payers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "officetel_purchase_costs: 본인만 CRUD" ON officetel_purchase_costs;
CREATE POLICY "officetel_purchase_costs: 본인만 CRUD" ON officetel_purchase_costs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_officetel_purchase_records_user ON officetel_purchase_records(user_id);
CREATE INDEX IF NOT EXISTS idx_officetel_purchase_payers_purchase ON officetel_purchase_payers(purchase_id);
CREATE INDEX IF NOT EXISTS idx_officetel_purchase_costs_purchase ON officetel_purchase_costs(purchase_id);

-- updated_at 자동 갱신 트리거 함수 (없을 경우 생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS officetel_purchase_records_updated_at ON officetel_purchase_records;
CREATE TRIGGER officetel_purchase_records_updated_at
  BEFORE UPDATE ON officetel_purchase_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
