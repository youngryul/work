-- 할 일 미룸 횟수 (백로그 점검의 병목 판단용)
-- Supabase SQL Editor에서 실행 (여러 번 실행해도 안전)

-- 1) 미룸 횟수: 오늘 할 일에 올렸다가 끝내지 못하고 백로그로 돌아갈 때마다 +1
--    - 날짜가 바뀌어 미완료 오늘 할 일이 백로그로 리셋될 때
--    - 사용자가 오늘 할 일을 직접 백로그로 보낼 때
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS postpone_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN tasks.postpone_count IS '오늘 할 일에서 끝내지 못하고 백로그로 돌아간 횟수';

-- 2) 미룸 횟수 +1 (읽고-쓰기 경합 없이 한 번에 증가)
--    SECURITY INVOKER 라서 tasks 의 RLS 가 그대로 적용되고, 본인 할 일만 바뀐다
CREATE OR REPLACE FUNCTION public.increment_task_postpone_count(p_task_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.tasks
  SET postpone_count = COALESCE(postpone_count, 0) + 1
  WHERE id = ANY (p_task_ids)
    AND completed = false
    AND user_id::text = auth.uid()::text;
$$;

GRANT EXECUTE ON FUNCTION public.increment_task_postpone_count(uuid[]) TO authenticated;
