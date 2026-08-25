-- 포실이 성장: 보유 젤리로 먹이를 최대 횟수만큼 한 번에 처리
-- Supabase SQL Editor에서 실행
-- 기존 process_farm_xp_event('milk_feed')를 반복 호출한다.

CREATE OR REPLACE FUNCTION public.feed_farm_milk_max(p_max_count INTEGER DEFAULT 200)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_limit INTEGER;
  v_feed_count INTEGER := 0;
  v_xp_awarded INTEGER := 0;
  v_jelly_spent INTEGER := 0;
  v_seed_granted INTEGER := 0;
  v_leveled_up BOOLEAN := false;
  v_stage INTEGER := NULL;
  v_result JSON;
  v_xp INTEGER;
  v_spent INTEGER;
  v_seed INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_max_count, 200), 0), 200);
  IF v_limit < 1 THEN
    RETURN json_build_object(
      'feedCount', 0,
      'xpAwarded', 0,
      'jellySpent', 0,
      'leveledUp', false,
      'stage', NULL,
      'seedGranted', 0
    );
  END IF;

  LOOP
    EXIT WHEN v_feed_count >= v_limit;

    BEGIN
      v_result := process_farm_xp_event(
        p_event_key := 'milk_feed',
        p_idempotency_key := NULL
      )::json;
    EXCEPTION WHEN OTHERS THEN
      IF v_feed_count = 0 THEN
        RAISE;
      END IF;
      EXIT;
    END;

    IF v_result IS NULL THEN
      EXIT;
    END IF;

    v_xp := COALESCE((v_result->>'xpAwarded')::INTEGER, (v_result->>'xp_awarded')::INTEGER, 0);
    v_spent := COALESCE((v_result->>'jellySpent')::INTEGER, (v_result->>'jelly_spent')::INTEGER, 0);
    v_seed := COALESCE((v_result->>'seedGranted')::INTEGER, (v_result->>'seed_granted')::INTEGER, 0);

    IF v_xp <= 0 AND NOT COALESCE((v_result->>'leveledUp')::BOOLEAN, (v_result->>'leveled_up')::BOOLEAN, false) THEN
      EXIT;
    END IF;

    v_feed_count := v_feed_count + 1;
    v_xp_awarded := v_xp_awarded + v_xp;
    v_jelly_spent := v_jelly_spent + v_spent;
    v_seed_granted := v_seed_granted + v_seed;

    IF COALESCE((v_result->>'leveledUp')::BOOLEAN, (v_result->>'leveled_up')::BOOLEAN, false) THEN
      v_leveled_up := true;
      v_stage := COALESCE((v_result->>'stage')::INTEGER, v_stage);
    END IF;

    IF v_leveled_up AND COALESCE(v_stage, 0) >= 10 THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'feedCount', v_feed_count,
    'xpAwarded', v_xp_awarded,
    'jellySpent', v_jelly_spent,
    'leveledUp', v_leveled_up,
    'stage', v_stage,
    'seedGranted', v_seed_granted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.feed_farm_milk_max(INTEGER) TO authenticated;
