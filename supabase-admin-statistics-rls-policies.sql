-- 관리자 통계 조회를 위한 RLS 정책 추가
-- 관리자는 모든 사용자의 데이터를 조회할 수 있어야 합니다.

-- is_admin() 함수가 이미 존재하는지 확인하고, 없다면 생성
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- tasks 테이블 관리자 조회 정책 추가
-- ============================================

-- 기존 정책이 있다면 삭제 후 재생성
DROP POLICY IF EXISTS "Admins can view all tasks" ON tasks;
CREATE POLICY "Admins can view all tasks" ON tasks
  FOR SELECT USING (is_admin());

-- ============================================
-- diaries 테이블 관리자 조회 정책 추가
-- ============================================

DROP POLICY IF EXISTS "Admins can view all diaries" ON diaries;
CREATE POLICY "Admins can view all diaries" ON diaries
  FOR SELECT USING (is_admin());

-- ============================================
-- reading_records 테이블 관리자 조회 정책 추가
-- ============================================

DROP POLICY IF EXISTS "Admins can view all reading_records" ON reading_records;
CREATE POLICY "Admins can view all reading_records" ON reading_records
  FOR SELECT USING (is_admin());

-- ============================================
-- five_year_answers 테이블 관리자 조회 정책 추가
-- ============================================

DROP POLICY IF EXISTS "Admins can view all five_year_answers" ON five_year_answers;
CREATE POLICY "Admins can view all five_year_answers" ON five_year_answers
  FOR SELECT USING (is_admin());

-- ============================================
-- five_year_questions 테이블 관리자 조회 정책 추가
-- ============================================
-- (이미 모든 사용자가 조회 가능하지만, 일관성을 위해 추가)

DROP POLICY IF EXISTS "Admins can view all five_year_questions" ON five_year_questions;
CREATE POLICY "Admins can view all five_year_questions" ON five_year_questions
  FOR SELECT USING (is_admin() OR true);
