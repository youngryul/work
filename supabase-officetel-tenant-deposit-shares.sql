-- 오피스텔 임차인 보증금 수령 내역 테이블
-- 임차인 보증금을 누가 얼마 가져갔는지 기록 (임차인 1명당 여러 명 가능)

CREATE TABLE IF NOT EXISTS officetel_tenant_deposit_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES officetel_tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  holder_name text NOT NULL,
  amount numeric(14, 0) NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE officetel_tenant_deposit_shares ENABLE ROW LEVEL SECURITY;

-- 본인만 CRUD 가능
DROP POLICY IF EXISTS "officetel_tenant_deposit_shares: 본인만 CRUD" ON officetel_tenant_deposit_shares;
CREATE POLICY "officetel_tenant_deposit_shares: 본인만 CRUD" ON officetel_tenant_deposit_shares
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_officetel_tenant_deposit_shares_tenant
  ON officetel_tenant_deposit_shares(tenant_id);
