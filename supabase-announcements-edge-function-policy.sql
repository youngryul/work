-- Edge Function을 위한 공지사항 INSERT 정책
-- Service Role Key를 사용하는 Edge Function은 RLS를 우회하지만,
-- 명시적으로 정책을 추가하여 안정성을 높입니다.

-- Edge Function용 INSERT 정책 (Service Role Key 사용 시)
-- Service Role Key를 사용하면 auth.uid()가 NULL이므로,
-- Service Role Key 자체를 확인하는 대신 항상 허용하는 정책을 추가합니다.
-- 단, 이는 Service Role Key를 사용할 때만 적용됩니다.

-- 기존 관리자 정책이 auth.uid()를 체크하므로 Service Role Key로는 작동하지 않을 수 있습니다.
-- 따라서 Service Role Key를 사용하는 경우를 위한 별도 정책이 필요합니다.

-- 방법 1: Service Role Key 사용 시 RLS 우회 (권장)
-- Service Role Key를 사용하면 자동으로 RLS를 우회하므로,
-- Edge Function 코드에서 Service Role Key를 올바르게 사용하고 있는지 확인해야 합니다.

-- 방법 2: Service Role Key를 위한 명시적 정책 추가
-- 하지만 Supabase에서는 Service Role Key 사용 시 자동으로 RLS를 우회하므로,
-- 이 정책은 필요하지 않을 수 있습니다.

-- 문제 해결: Edge Function이 Service Role Key를 올바르게 사용하는지 확인
-- 만약 여전히 문제가 있다면, 다음 정책을 추가할 수 있습니다:

-- Service Role Key 사용 시 INSERT 허용 (auth.role() = 'service_role' 체크)
DROP POLICY IF EXISTS "Service role can insert announcements" ON announcements;
CREATE POLICY "Service role can insert announcements" ON announcements
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

-- Service Role Key 사용 시 모든 공지사항 조회 허용
DROP POLICY IF EXISTS "Service role can view all announcements" ON announcements;
CREATE POLICY "Service role can view all announcements" ON announcements
  FOR SELECT 
  USING (auth.role() = 'service_role');

-- Service Role Key 사용 시 UPDATE 허용
DROP POLICY IF EXISTS "Service role can update announcements" ON announcements;
CREATE POLICY "Service role can update announcements" ON announcements
  FOR UPDATE 
  USING (auth.role() = 'service_role');

-- Service Role Key 사용 시 DELETE 허용
DROP POLICY IF EXISTS "Service role can delete announcements" ON announcements;
CREATE POLICY "Service role can delete announcements" ON announcements
  FOR DELETE 
  USING (auth.role() = 'service_role');
