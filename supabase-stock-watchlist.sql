-- 사용자 주식 관심 종목 (시세는 Finnhub API로 조회)

CREATE TABLE IF NOT EXISTS user_stock_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  display_name TEXT NOT NULL,
  exchange TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_user_stock_watchlist_user_id
  ON user_stock_watchlist (user_id);

ALTER TABLE user_stock_watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_stock_watchlist" ON user_stock_watchlist;
CREATE POLICY "users_select_own_stock_watchlist" ON user_stock_watchlist
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_stock_watchlist" ON user_stock_watchlist;
CREATE POLICY "users_insert_own_stock_watchlist" ON user_stock_watchlist
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_stock_watchlist" ON user_stock_watchlist;
CREATE POLICY "users_update_own_stock_watchlist" ON user_stock_watchlist
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_stock_watchlist" ON user_stock_watchlist;
CREATE POLICY "users_delete_own_stock_watchlist" ON user_stock_watchlist
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 기존 DB에 주식 메뉴 권한 추가
UPDATE role_menu_permissions
SET allowed_menu_ids = array_append(allowed_menu_ids, 'stocks')
WHERE NOT ('stocks' = ANY(allowed_menu_ids));
