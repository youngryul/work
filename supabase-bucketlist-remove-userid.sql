-- 버킷리스트 테이블에서 user_id 제거
-- 기존 테이블이 있는 경우 이 스크립트를 실행하여 user_id 제약조건을 제거하세요

-- 1. user_id 인덱스 제거
DROP INDEX IF EXISTS idx_bucketlists_user_id;

-- 2. user_id NOT NULL 제약조건 제거 (nullable로 변경)
ALTER TABLE bucketlists ALTER COLUMN user_id DROP NOT NULL;

-- 참고: user_id 컬럼 자체를 완전히 제거하려면 다음 명령을 실행하세요:
-- ALTER TABLE bucketlists DROP COLUMN IF EXISTS user_id;

