-- 회원 탈퇴: 로그인한 사용자의 데이터와 계정을 삭제 (App Store 심사 5.1.1(v) 대응)
-- Supabase SQL Editor에서 실행
--
-- 동작
-- 1. public 스키마에서 user_id 컬럼이 있는 모든 테이블의 본인 행을 삭제
--    - 테이블끼리 외래키로 묶여 있어 삭제 순서가 맞지 않으면 실패할 수 있으므로,
--      실패한 테이블은 다음 회차에 다시 시도한다 (최대 10회).
-- 2. auth.users에서 본인 계정 삭제 (ON DELETE CASCADE로 걸린 행도 함께 삭제됨)
--
-- 참고: Storage에 올린 이미지 파일은 삭제되지 않는다.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_table record;
  v_pass int := 0;
  v_failed int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다.';
  END IF;

  LOOP
    v_pass := v_pass + 1;
    v_failed := 0;

    FOR v_table IN
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public'
        AND c.column_name = 'user_id'
        AND t.table_type = 'BASE TABLE'
    LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE user_id::text = $1', v_table.table_name)
          USING v_uid::text;
      EXCEPTION WHEN foreign_key_violation THEN
        -- 다른 테이블이 아직 참조 중: 다음 회차에 다시 시도
        v_failed := v_failed + 1;
      END;
    END LOOP;

    EXIT WHEN v_failed = 0;
    IF v_pass >= 10 THEN
      RAISE EXCEPTION '데이터 삭제 중 참조 관계 때문에 실패했습니다.';
    END IF;
  END LOOP;

  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
