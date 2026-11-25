-- 백로그 점검 기록 (점검할 때마다 핵심 지표를 쌓아 추이를 보여줌)
-- Supabase SQL Editor에서 실행 (여러 번 실행해도 안전)

-- ---------------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.backlog_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 백로그 수, 2주 이상 묵은 수, 미룬 수, 주당 완료, 소진 예상 주수 등 (앱이 계산한 값)
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- AI 진단 요약 한두 문장
  summary TEXT NOT NULL DEFAULT '',
  -- 이번 점검에서 병목으로 꼽힌 할일 ID (다음 점검 때 "해소됐는지" 비교용)
  -- 할일이 삭제돼도 기록은 남도록 FK 는 걸지 않음
  bottleneck_task_ids UUID[] NOT NULL DEFAULT '{}'
);

COMMENT ON TABLE public.backlog_health_checks IS '백로그 점검 기록 (지표 추이·병목 해소 비교용)';

CREATE INDEX IF NOT EXISTS backlog_health_checks_user_checked_idx
  ON public.backlog_health_checks (user_id, checked_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: 본인 기록만 조회·추가·삭제
-- ---------------------------------------------------------------------------

ALTER TABLE public.backlog_health_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS backlog_health_checks_select ON public.backlog_health_checks;
CREATE POLICY backlog_health_checks_select ON public.backlog_health_checks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS backlog_health_checks_insert ON public.backlog_health_checks;
CREATE POLICY backlog_health_checks_insert ON public.backlog_health_checks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS backlog_health_checks_delete ON public.backlog_health_checks;
CREATE POLICY backlog_health_checks_delete ON public.backlog_health_checks
  FOR DELETE USING (auth.uid() = user_id);
