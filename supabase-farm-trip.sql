-- 포실이 여행: 10단계 이후 콘텐츠
-- Supabase SQL Editor에서 실행 (여러 번 실행해도 안전)
-- 젤리를 받으면 award_jelly 안에서 여행 거리가 함께 늘어난다.

-- ---------------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.farm_trip_courses (
  course_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT NOT NULL,
  bonus_label TEXT NOT NULL,
  bonus_reasons TEXT[] NOT NULL DEFAULT '{}',
  total_km INTEGER NOT NULL CHECK (total_km > 0),
  reward_seed_count INTEGER NOT NULL DEFAULT 0,
  badge_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.farm_trip_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_key TEXT NOT NULL REFERENCES public.farm_trip_courses (course_key) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  km_at INTEGER NOT NULL CHECK (km_at > 0),
  message TEXT NOT NULL,
  image_url TEXT,
  UNIQUE (course_key, seq)
);

CREATE TABLE IF NOT EXISTS public.user_farm_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_key TEXT NOT NULL REFERENCES public.farm_trip_courses (course_key),
  -- traveling: 이동 중 / arrived: 완주, 보상 대기 / claimed: 보상 수령
  status TEXT NOT NULL DEFAULT 'traveling' CHECK (status IN ('traveling', 'arrived', 'claimed')),
  distance_km INTEGER NOT NULL DEFAULT 0,
  distance_today INTEGER NOT NULL DEFAULT 0,
  distance_day DATE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  arrived_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ
);

-- 진행 중인 여행은 사용자당 하나만 허용
CREATE UNIQUE INDEX IF NOT EXISTS user_farm_trips_one_active_idx
  ON public.user_farm_trips (user_id)
  WHERE status IN ('traveling', 'arrived');

CREATE INDEX IF NOT EXISTS user_farm_trips_user_course_idx
  ON public.user_farm_trips (user_id, course_key, status);

CREATE TABLE IF NOT EXISTS public.user_farm_postcards (
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  stop_id UUID NOT NULL REFERENCES public.farm_trip_stops (id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, stop_id)
);

-- ---------------------------------------------------------------------------
-- RLS — 쓰기는 SECURITY DEFINER RPC로만 한다
-- ---------------------------------------------------------------------------

ALTER TABLE public.farm_trip_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farm_trip_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_farm_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_farm_postcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farm_trip_courses_select ON public.farm_trip_courses;
CREATE POLICY farm_trip_courses_select ON public.farm_trip_courses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS farm_trip_stops_select ON public.farm_trip_stops;
CREATE POLICY farm_trip_stops_select ON public.farm_trip_stops
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS user_farm_trips_select_own ON public.user_farm_trips;
CREATE POLICY user_farm_trips_select_own ON public.user_farm_trips
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_farm_postcards_select_own ON public.user_farm_postcards;
CREATE POLICY user_farm_postcards_select_own ON public.user_farm_postcards
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 기본 설정 · 코스 데이터
-- ---------------------------------------------------------------------------

INSERT INTO public.farm_settings (key, value, label)
SELECT 'trip_start_jelly_cost', '20', '여행 도시락 젤리'
WHERE NOT EXISTS (SELECT 1 FROM public.farm_settings WHERE key = 'trip_start_jelly_cost');

INSERT INTO public.farm_settings (key, value, label)
SELECT 'trip_daily_km_cap', '40', '여행 하루 이동 상한(km)'
WHERE NOT EXISTS (SELECT 1 FROM public.farm_settings WHERE key = 'trip_daily_km_cap');

INSERT INTO public.farm_trip_courses
  (course_key, title, emoji, description, bonus_label, bonus_reasons, total_km, reward_seed_count, sort_order)
VALUES
  ('sea_village', '바다 마을', '🌊', '파도 소리를 따라 작은 바닷가 마을로 떠나요.',
   '일기·5년 질문 2배', ARRAY['diary_write', 'five_year_answer'], 80, 2, 1),
  ('library_city', '도서관 도시', '📚', '책 냄새 가득한 도시에서 천천히 걸어요.',
   '타이머 기록 2배', ARRAY['study_timer'], 120, 3, 2),
  ('cloud_mountain', '구름 산', '⛰️', '구름 위 봉우리까지 한 걸음씩 올라가요.',
   '걸음 수·몸무게·습관 2배',
   ARRAY['step_milestone', 'weight_record', 'weight_goal_reached', 'habit_tracker_first_today'], 160, 4, 3)
ON CONFLICT (course_key) DO UPDATE SET
  title = EXCLUDED.title,
  emoji = EXCLUDED.emoji,
  description = EXCLUDED.description,
  bonus_label = EXCLUDED.bonus_label,
  bonus_reasons = EXCLUDED.bonus_reasons,
  total_km = EXCLUDED.total_km,
  reward_seed_count = EXCLUDED.reward_seed_count,
  sort_order = EXCLUDED.sort_order;

-- image_url은 덮어쓰지 않는다 (이미지 준비 후 직접 넣은 값 유지)
INSERT INTO public.farm_trip_stops (course_key, seq, name, emoji, km_at, message)
VALUES
  ('sea_village', 1, '조개 해변', '🐚', 25, '예쁜 조개를 주웠어요. 주머니가 벌써 묵직해요!'),
  ('sea_village', 2, '등대 언덕', '🗼', 50, '등대에서 내려다본 바다가 반짝반짝 빛나요.'),
  ('sea_village', 3, '노을 항구', '🌅', 80, '오늘 노을은 꼭 같이 보고 싶었어요.'),
  ('library_city', 1, '책방 골목', '📖', 40, '오래된 책방 고양이와 친구가 됐어요.'),
  ('library_city', 2, '별빛 도서관', '🌟', 80, '천장에 별이 뜨는 도서관을 찾았어요!'),
  ('library_city', 3, '시계탑 광장', '🕰️', 120, '시계탑 종소리에 맞춰 잠깐 쉬어 가요.'),
  ('cloud_mountain', 1, '들꽃 오솔길', '🌼', 50, '이름 모를 들꽃이 길을 안내해 줘요.'),
  ('cloud_mountain', 2, '구름다리', '☁️', 100, '구름 위를 걷는 기분이에요. 조금 무서워요!'),
  ('cloud_mountain', 3, '해돋이 봉우리', '🌄', 160, '드디어 정상! 해가 떠오르는 걸 봤어요.')
ON CONFLICT (course_key, seq) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  km_at = EXCLUDED.km_at,
  message = EXCLUDED.message;

-- ---------------------------------------------------------------------------
-- 내부 함수
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_farm_trip_setting(p_key TEXT, p_default INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(trim(value::text), '')::integer FROM farm_settings WHERE key = p_key LIMIT 1),
    p_default
  );
$$;

-- award_jelly 전용. 클라이언트가 직접 호출하면 거리를 조작할 수 있으므로 실행 권한을 막는다.
CREATE OR REPLACE FUNCTION public.advance_farm_trip(p_user_id UUID, p_reason TEXT, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip user_farm_trips%ROWTYPE;
  v_course farm_trip_courses%ROWTYPE;
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::date;
  v_daily_cap INTEGER := get_farm_trip_setting('trip_daily_km_cap', 40);
  v_used_today INTEGER;
  v_gain INTEGER;
  v_distance INTEGER;
BEGIN
  -- 환불·작물 요청 등 기록이 아닌 젤리는 거리에 넣지 않는다
  IF p_reason NOT IN (
    'task_complete',
    'diary_write',
    'weight_record',
    'weight_goal_reached',
    'five_year_answer',
    'habit_tracker_first_today',
    'recipe_create',
    'step_milestone',
    'study_timer'
  ) THEN
    RETURN;
  END IF;

  SELECT * INTO v_trip
  FROM user_farm_trips
  WHERE user_id = p_user_id AND status = 'traveling'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO v_course FROM farm_trip_courses WHERE course_key = v_trip.course_key;

  v_used_today := CASE WHEN v_trip.distance_day = v_today THEN v_trip.distance_today ELSE 0 END;

  v_gain := LEAST(
    p_amount * CASE WHEN p_reason = ANY (v_course.bonus_reasons) THEN 2 ELSE 1 END,
    GREATEST(v_daily_cap - v_used_today, 0),
    v_course.total_km - v_trip.distance_km
  );

  IF v_gain <= 0 THEN
    RETURN;
  END IF;

  v_distance := v_trip.distance_km + v_gain;

  UPDATE user_farm_trips
  SET distance_km = v_distance,
      distance_today = v_used_today + v_gain,
      distance_day = v_today,
      status = CASE WHEN v_distance >= v_course.total_km THEN 'arrived' ELSE status END,
      arrived_at = CASE WHEN v_distance >= v_course.total_km THEN NOW() ELSE arrived_at END
  WHERE id = v_trip.id;

  INSERT INTO user_farm_postcards (user_id, stop_id)
  SELECT p_user_id, s.id
  FROM farm_trip_stops s
  WHERE s.course_key = v_trip.course_key AND s.km_at <= v_distance
  ON CONFLICT (user_id, stop_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.advance_farm_trip(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- award_jelly — 운영 DB 정의에 study_timer 허용과 여행 거리 반영을 추가
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.award_jelly(p_amount integer, p_reason text, p_idempotency_key text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance INTEGER;
  v_inserted BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION '지급 젤리는 1 이상이어야 합니다.';
  END IF;

  IF p_reason NOT IN (
    'task_complete',
    'diary_write',
    'weight_record',
    'weight_goal_reached',
    'farm_refund',
    'five_year_answer',
    'habit_tracker_first_today',
    'recipe_create',
    'step_milestone',
    'farm_crop_request',
    'study_timer'
  ) THEN
    RAISE EXCEPTION '유효하지 않은 지급 사유입니다.';
  END IF;

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key가 필요합니다.';
  END IF;

  INSERT INTO user_jelly (user_id, balance)
  VALUES (v_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO jelly_rewards_log (user_id, amount, reason, idempotency_key)
  VALUES (v_user_id, p_amount, p_reason, trim(p_idempotency_key))
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING true INTO v_inserted;

  IF NOT COALESCE(v_inserted, false) THEN
    SELECT balance INTO v_balance FROM user_jelly WHERE user_id = v_user_id;
    RETURN json_build_object(
      'balance', COALESCE(v_balance, 0),
      'awarded', 0,
      'alreadyAwarded', true
    );
  END IF;

  UPDATE user_jelly
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_balance;

  -- 여행 처리 오류가 젤리 지급을 막지 않도록 분리한다
  BEGIN
    PERFORM advance_farm_trip(v_user_id, p_reason, p_amount);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '여행 거리 반영 실패: %', SQLERRM;
  END;

  RETURN json_build_object(
    'balance', v_balance,
    'awarded', p_amount,
    'alreadyAwarded', false
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 클라이언트 RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_farm_trip()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Seoul')::date;
  v_active JSON;
  v_courses JSON;
  v_unseen JSON;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT json_build_object(
    'id', t.id,
    'courseKey', t.course_key,
    'status', t.status,
    'distanceKm', t.distance_km,
    'todayKm', CASE WHEN t.distance_day = v_today THEN t.distance_today ELSE 0 END,
    'startedAt', t.started_at
  ) INTO v_active
  FROM user_farm_trips t
  WHERE t.user_id = v_user_id AND t.status IN ('traveling', 'arrived')
  LIMIT 1;

  SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.sort_order), '[]'::json) INTO v_courses
  FROM (
    SELECT
      fc.course_key AS "courseKey",
      fc.title,
      fc.emoji,
      fc.description,
      fc.bonus_label AS "bonusLabel",
      fc.total_km AS "totalKm",
      fc.reward_seed_count AS "rewardSeedCount",
      fc.badge_image_url AS "badgeImageUrl",
      fc.sort_order,
      (
        SELECT COUNT(*)::integer FROM user_farm_trips t
        WHERE t.user_id = v_user_id AND t.course_key = fc.course_key AND t.status = 'claimed'
      ) AS "clearCount",
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', s.id,
          'seq', s.seq,
          'name', s.name,
          'emoji', s.emoji,
          'kmAt', s.km_at,
          'message', s.message,
          'imageUrl', s.image_url,
          'collected', p.stop_id IS NOT NULL
        ) ORDER BY s.seq), '[]'::json)
        FROM farm_trip_stops s
        LEFT JOIN user_farm_postcards p ON p.stop_id = s.id AND p.user_id = v_user_id
        WHERE s.course_key = fc.course_key
      ) AS stops
    FROM farm_trip_courses fc
    WHERE fc.is_active
  ) c;

  SELECT COALESCE(json_agg(json_build_object(
    'id', s.id,
    'seq', s.seq,
    'name', s.name,
    'emoji', s.emoji,
    'kmAt', s.km_at,
    'message', s.message,
    'imageUrl', s.image_url,
    'collected', true
  ) ORDER BY p.acquired_at), '[]'::json) INTO v_unseen
  FROM user_farm_postcards p
  JOIN farm_trip_stops s ON s.id = p.stop_id
  WHERE p.user_id = v_user_id AND p.seen_at IS NULL;

  RETURN json_build_object(
    'startJellyCost', get_farm_trip_setting('trip_start_jelly_cost', 20),
    'dailyKmCap', get_farm_trip_setting('trip_daily_km_cap', 40),
    'activeTrip', v_active,
    'courses', v_courses,
    'unseenPostcards', v_unseen
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.start_farm_trip(p_course_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_stage INTEGER;
  v_cost INTEGER := get_farm_trip_setting('trip_start_jelly_cost', 20);
  v_balance INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT stage INTO v_stage FROM user_farm_progress WHERE user_id = v_user_id;
  IF COALESCE(v_stage, 0) < 10 THEN
    RAISE EXCEPTION '10단계가 되면 여행을 떠날 수 있어요.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM farm_trip_courses WHERE course_key = p_course_key AND is_active
  ) THEN
    RAISE EXCEPTION '선택할 수 없는 코스예요.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_farm_trips
    WHERE user_id = v_user_id AND status IN ('traveling', 'arrived')
  ) THEN
    RAISE EXCEPTION '이미 진행 중인 여행이 있어요.';
  END IF;

  UPDATE user_jelly
  SET balance = balance - v_cost,
      updated_at = NOW()
  WHERE user_id = v_user_id AND balance >= v_cost
  RETURNING balance INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION '젤리가 부족해요. 도시락에는 젤리 %개가 필요해요.', v_cost;
  END IF;

  INSERT INTO user_farm_trips (user_id, course_key)
  VALUES (v_user_id, p_course_key);

  RETURN json_build_object(
    'jellySpent', v_cost,
    'jellyBalance', v_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_farm_trip_reward()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_trip user_farm_trips%ROWTYPE;
  v_course farm_trip_courses%ROWTYPE;
  v_first_clear BOOLEAN;
  v_seed_granted INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT * INTO v_trip
  FROM user_farm_trips
  WHERE user_id = v_user_id AND status = 'arrived'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '받을 수 있는 여행 보상이 없어요.';
  END IF;

  SELECT * INTO v_course FROM farm_trip_courses WHERE course_key = v_trip.course_key;

  -- 씨앗과 배지는 코스별 첫 완주에만 준다
  v_first_clear := NOT EXISTS (
    SELECT 1 FROM user_farm_trips
    WHERE user_id = v_user_id AND course_key = v_trip.course_key AND status = 'claimed'
  );

  IF v_first_clear AND v_course.reward_seed_count > 0 THEN
    v_seed_granted := v_course.reward_seed_count;
    INSERT INTO user_farm_inventory (user_id, seed_count, welcome_seed_granted)
    VALUES (v_user_id, v_seed_granted, true)
    ON CONFLICT (user_id) DO UPDATE
    SET seed_count = user_farm_inventory.seed_count + EXCLUDED.seed_count,
        updated_at = NOW();
  END IF;

  UPDATE user_farm_trips
  SET status = 'claimed',
      claimed_at = NOW()
  WHERE id = v_trip.id;

  RETURN json_build_object(
    'courseTitle', v_course.title,
    'firstClear', v_first_clear,
    'seedGranted', v_seed_granted
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_farm_postcards_seen()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  UPDATE user_farm_postcards
  SET seen_at = NOW()
  WHERE user_id = auth.uid() AND seen_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_farm_trip() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.start_farm_trip(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_farm_trip_reward() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_farm_postcards_seen() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_farm_trip() TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_farm_trip(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_farm_trip_reward() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_farm_postcards_seen() TO authenticated;
