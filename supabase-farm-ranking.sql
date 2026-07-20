-- 포실이 성장 랭킹 (stage DESC, xp DESC)
-- RLS로 타인 progress를 못 읽으므로 SECURITY DEFINER RPC로만 공개

ALTER TABLE user_farm_progress
  ADD COLUMN IF NOT EXISTS active_character_id UUID REFERENCES gacha_characters(id) ON DELETE SET NULL;

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

  SELECT COALESCE(json_agg(payload ORDER BY sort_rank ASC), '[]'::json)
  INTO v_result
  FROM (
    SELECT
      ranked.rank AS sort_rank,
      json_build_object(
        'rank', ranked.rank,
        'userId', ranked.user_id,
        'displayName', ranked.display_name,
        'isMe', ranked.user_id = v_user_id,
        'stage', ranked.stage,
        'xp', ranked.xp,
        'activeCharacter', ranked.active_character
      ) AS payload
    FROM (
      SELECT
        ROW_NUMBER() OVER (
          ORDER BY p.stage DESC, p.xp DESC, p.updated_at ASC
        )::INTEGER AS rank,
        p.user_id,
        p.stage,
        p.xp,
        ('농부 ' || upper(substr(replace(p.user_id::text, '-', ''), 1, 6))) AS display_name,
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
      LEFT JOIN gacha_characters c ON c.id = p.active_character_id
      WHERE p.farm_unlocked = true OR p.stage > 1 OR p.xp > 0
      ORDER BY p.stage DESC, p.xp DESC, p.updated_at ASC
      LIMIT v_limit
    ) ranked
  ) rows;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_farm_ranking(INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
