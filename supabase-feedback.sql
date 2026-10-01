-- 포실이 피드백 (기능 제안·버그 제보 등) 테이블 + RLS
-- Supabase SQL Editor에서 실행
-- 작성자는 본인 피드백만, 관리자(is_admin)는 전체 피드백을 조회/처리할 수 있습니다.

CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  user_email TEXT,
  category TEXT NOT NULL CHECK (category IN ('feature', 'bug', 'improvement', 'other')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'done', 'rejected')),
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedbacks_user_id_idx ON feedbacks (user_id);
CREATE INDEX IF NOT EXISTS feedbacks_status_created_idx ON feedbacks (status, created_at DESC);

ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- 작성: 로그인 사용자 본인 명의로만
DROP POLICY IF EXISTS "feedbacks_insert_own" ON feedbacks;
CREATE POLICY "feedbacks_insert_own" ON feedbacks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 조회: 본인 피드백 또는 관리자 (다른 사용자에게는 보이지 않음)
DROP POLICY IF EXISTS "feedbacks_select_own_or_admin" ON feedbacks;
CREATE POLICY "feedbacks_select_own_or_admin" ON feedbacks
  FOR SELECT USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- 상태 변경·답변: 관리자만
DROP POLICY IF EXISTS "feedbacks_update_admin" ON feedbacks;
CREATE POLICY "feedbacks_update_admin" ON feedbacks
  FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- 삭제: 관리자만
DROP POLICY IF EXISTS "feedbacks_delete_admin" ON feedbacks;
CREATE POLICY "feedbacks_delete_admin" ON feedbacks
  FOR DELETE USING (is_admin(auth.uid()));

-- updated_at 자동 갱신 트리거 함수 (없을 경우 생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feedbacks_updated_at ON feedbacks;
CREATE TRIGGER feedbacks_updated_at
  BEFORE UPDATE ON feedbacks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
