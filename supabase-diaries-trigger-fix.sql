-- diaries 테이블용 updated_at 자동 업데이트 트리거 함수
-- 기존 함수가 updatedat을 참조하므로 diaries 테이블용으로 별도 함수 생성

CREATE OR REPLACE FUNCTION update_diaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS update_diaries_updatedat ON diaries;

CREATE TRIGGER update_diaries_updated_at
  BEFORE UPDATE ON diaries
  FOR EACH ROW
  EXECUTE FUNCTION update_diaries_updated_at();

