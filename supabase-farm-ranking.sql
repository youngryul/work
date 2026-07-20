-- 포실이 성장 랭킹 (stage DESC, xp DESC)
-- RLS로 타인 progress를 못 읽으므로 SECURITY DEFINER RPC로만 공개

CREATE OR REPLACE FUNCTION get_farm_ranking(p_limit INTEGER DEFAULT 50)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_limit INTEGER;
  v_result JSON;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);

  SELECT COALESCE(json_agg(row_data ORDER BY row_data."rank"), '[]'::json)
  INTO v_result
  FROM (
    SELECT json_build_object(
      'rank', ranked.rank,
      'userId', ranked.user_id,
      'displayName', ranked.display_name,
      'isMe', ranked.user_id = v_user_id,
      'stage', ranked.stage,
      'xp', ranked.xp,
      'activeCharacter', ranked.active_character
    ) AS row_data
    FROM (
      SELECT
        ROW_NUMBER() OVER (ORDER BY p.stage DESC, p.xp DESC, p.updated_at ASC) AS rank,
        p.user_id,
        p.stage,
        p.xp,
        CASE
          WHEN u.email IS NULL OR u.email = '' THEN '포실이 농부'
          WHEN length(split_part(u.email, '@', 1)) <= 2 THEN
            left(split_part(u.email, '@', 1), 1) || '***'
          ELSE
            left(split_part(u.email, '@', 1), 2) || '***'
        END AS display_name,
        CASE
          WHEN c.id IS NULL THEN NULL
          ELSE json_build_object(
            'characterId', c.id,
            'name', c.name,
            'grade', c.grade,
            'imageUrl', c.image_url
          )
        END AS active_character
      FROM user_farm_progress p
      LEFT JOIN auth.users u ON u.id = p.user_id
      LEFT JOIN gacha_characters c ON c.id = p.active_character_id
      WHERE p.farm_unlocked = true OR p.stage > 1 OR p.xp > 0
      ORDER BY p.stage DESC, p.xp DESC, p.updated_at ASC
      LIMIT v_limit
    ) ranked
  ) t;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_farm_ranking(INTEGER) TO authenticated;

-- PostgREST 스키마 캐시 갱신 (404 방지)
NOTIFY pgrst, 'reload schema';
