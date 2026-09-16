-- 매월 1일 지난 달 통계(타이머·할일) 회고 팝업 표시 이력 테이블
-- 한 번 본 달(period_month)은 다시 표시하지 않기 위해 사용

CREATE TABLE IF NOT EXISTS monthly_stats_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month text NOT NULL,   -- 통계 대상 달, 'YYYY-MM' 형식 (예: '2026-08')
  shown_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_month)
);

-- RLS 활성화
ALTER TABLE monthly_stats_popups ENABLE ROW LEVEL SECURITY;

-- 본인만 CRUD 가능
CREATE POLICY "monthly_stats_popups: 본인만 CRUD" ON monthly_stats_popups
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_monthly_stats_popups_user ON monthly_stats_popups(user_id, period_month);
