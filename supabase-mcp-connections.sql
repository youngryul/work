-- 포실이 MCP A안: 사용자별 연결 키
-- 설계: BACKLOG_MCP_KEYS_DESIGN.md
-- Supabase SQL Editor에서 실행

-- pgcrypto (Supabase는 extensions 스키마에 설치되어 있음)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 연결 키 (원문은 저장하지 않고 SHA-256 해시만 저장)
CREATE TABLE IF NOT EXISTS mcp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_mcp_connections_user ON mcp_connections(user_id, created_at DESC);

ALTER TABLE mcp_connections ENABLE ROW LEVEL SECURITY;

-- 본인 키 조회만 허용 (발급·폐기는 아래 함수로만)
DROP POLICY IF EXISTS "mcp_connections: 본인 조회" ON mcp_connections;
CREATE POLICY "mcp_connections: 본인 조회" ON mcp_connections
  FOR SELECT USING (auth.uid() = user_id);

-- 사용 한도 카운터 (서버 전용, 정책 없음 → service role과 아래 함수만 접근)
CREATE TABLE IF NOT EXISTS mcp_rate_counters (
  connection_id uuid NOT NULL REFERENCES mcp_connections(id) ON DELETE CASCADE,
  bucket text NOT NULL,  -- 'm:YYYY-MM-DDTHH:MM' (분) / 'd:YYYY-MM-DD:tasks' (일)
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (connection_id, bucket)
);

ALTER TABLE mcp_rate_counters ENABLE ROW LEVEL SECURITY;

-- 키 발급: 로그인한 모든 사용자, 사용 중인 키 최대 5개
-- 원문 키는 이 응답에서 한 번만 돌려준다
CREATE OR REPLACE FUNCTION issue_mcp_key(p_label text)
RETURNS TABLE (id uuid, raw_key text, key_prefix text, label text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_active_count integer;
  v_raw_key text;
  v_label text := left(trim(coalesce(p_label, '')), 50);
  v_id uuid;
  v_key_prefix text;
  v_saved_label text;
  v_created_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  SELECT count(*) INTO v_active_count
  FROM mcp_connections c
  WHERE c.user_id = v_user_id AND c.revoked_at IS NULL;
  IF v_active_count >= 5 THEN
    RAISE EXCEPTION '연결 키는 최대 5개까지 만들 수 있습니다. 쓰지 않는 키를 먼저 폐기해 주세요.';
  END IF;

  v_raw_key := 'psl_' || encode(gen_random_bytes(32), 'hex');

  INSERT INTO mcp_connections AS c (user_id, label, key_hash, key_prefix)
  VALUES (
    v_user_id,
    CASE WHEN v_label = '' THEN 'Claude' ELSE v_label END,
    encode(digest(v_raw_key, 'sha256'), 'hex'),
    left(v_raw_key, 12)
  )
  RETURNING c.id, c.key_prefix, c.label, c.created_at
  INTO v_id, v_key_prefix, v_saved_label, v_created_at;

  RETURN QUERY SELECT v_id, v_raw_key, v_key_prefix, v_saved_label, v_created_at;
END;
$$;

-- 키 폐기 (본인 키만)
CREATE OR REPLACE FUNCTION revoke_mcp_key(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  UPDATE mcp_connections
  SET revoked_at = now()
  WHERE id = p_id AND user_id = auth.uid() AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION '폐기할 키를 찾을 수 없습니다.';
  END IF;
END;
$$;

-- 사용 한도 소비: 한도 안이면 더하고 true, 넘으면 그대로 두고 false
CREATE OR REPLACE FUNCTION mcp_consume(p_connection_id uuid, p_bucket text, p_amount integer, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO mcp_rate_counters (connection_id, bucket, count)
  VALUES (p_connection_id, p_bucket, 0)
  ON CONFLICT (connection_id, bucket) DO NOTHING;

  UPDATE mcp_rate_counters
  SET count = count + p_amount, updated_at = now()
  WHERE connection_id = p_connection_id
    AND bucket = p_bucket
    AND count + p_amount <= p_limit
  RETURNING count INTO v_count;

  -- 가끔 오래된 카운터 정리
  IF random() < 0.01 THEN
    DELETE FROM mcp_rate_counters WHERE updated_at < now() - interval '2 days';
  END IF;

  RETURN v_count IS NOT NULL;
END;
$$;

-- 실행 권한: 발급·폐기는 로그인 사용자, 한도 소비는 서버(service role)만
REVOKE ALL ON FUNCTION issue_mcp_key(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION revoke_mcp_key(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mcp_consume(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION issue_mcp_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_mcp_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mcp_consume(uuid, text, integer, integer) TO service_role;
