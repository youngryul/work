-- 오피스텔 임차인 관리 테이블
-- 매물별 임차인(이름, 계약기간, 보증금, 월세)과 월별 월세 수령 체크 기록

CREATE TABLE IF NOT EXISTS officetel_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES officetel_purchase_records(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_name text NOT NULL,
  contract_start_date date NOT NULL,
  contract_end_date date NOT NULL,
  deposit numeric(14, 0) NOT NULL DEFAULT 0,
  monthly_rent numeric(14, 0) NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 월별 월세 수령 체크 (체크된 달만 행으로 존재)
CREATE TABLE IF NOT EXISTS officetel_tenant_rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES officetel_tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pay_month text NOT NULL, -- 'YYYY-MM'
  paid_date date,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, pay_month)
);

-- RLS 활성화
ALTER TABLE officetel_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE officetel_tenant_rent_payments ENABLE ROW LEVEL SECURITY;

-- 본인만 CRUD 가능
DROP POLICY IF EXISTS "officetel_tenants: 본인만 CRUD" ON officetel_tenants;
CREATE POLICY "officetel_tenants: 본인만 CRUD" ON officetel_tenants
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "officetel_tenant_rent_payments: 본인만 CRUD" ON officetel_tenant_rent_payments;
CREATE POLICY "officetel_tenant_rent_payments: 본인만 CRUD" ON officetel_tenant_rent_payments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_officetel_tenants_purchase ON officetel_tenants(purchase_id);
CREATE INDEX IF NOT EXISTS idx_officetel_tenant_rent_payments_tenant ON officetel_tenant_rent_payments(tenant_id);

-- updated_at 자동 갱신 트리거 함수 (없을 경우 생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS officetel_tenants_updated_at ON officetel_tenants;
CREATE TRIGGER officetel_tenants_updated_at
  BEFORE UPDATE ON officetel_tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
