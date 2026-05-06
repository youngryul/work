-- 유저별 AdSense(광고) 노출 여부
-- Supabase SQL Editor에서 실행한 뒤 앱을 사용하세요.

CREATE TABLE IF NOT EXISTS user_ad_settings (
  user_id UUID PRIMARY KEY,
  ads_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_ad_settings IS '유저별 애드센스 광고 표시 여부 (행이 없으면 표시로 간주)';

CREATE INDEX IF NOT EXISTS idx_user_ad_settings_ads_enabled ON user_ad_settings (ads_enabled);

ALTER TABLE user_ad_settings ENABLE ROW LEVEL SECURITY;

-- 본인 설정 조회
CREATE POLICY "users_read_own_ad_settings" ON user_ad_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 행 생성 (선택적)
CREATE POLICY "users_insert_own_ad_settings" ON user_ad_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 설정 수정
CREATE POLICY "users_update_own_ad_settings" ON user_ad_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 관리자: 전 유저 조회·삽입·수정
CREATE POLICY "admins_manage_all_ad_settings" ON user_ad_settings
  FOR ALL
  USING (is_admin(auth.uid()));
