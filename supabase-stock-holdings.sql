-- 관심 종목 보유량·평단가 (평가손익 계산용)

ALTER TABLE user_stock_watchlist
  ADD COLUMN IF NOT EXISTS holdings_quantity NUMERIC,
  ADD COLUMN IF NOT EXISTS average_price NUMERIC;

COMMENT ON COLUMN user_stock_watchlist.holdings_quantity IS '보유 수량';
COMMENT ON COLUMN user_stock_watchlist.average_price IS '평균 매입 단가';
