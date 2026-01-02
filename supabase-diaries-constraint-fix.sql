-- diaries 테이블의 UNIQUE 제약 조건 확인 및 수정
-- 이 스크립트는 "there is no unique or exclusion constraint matching the ON CONFLICT specification" 오류를 해결합니다.

-- 1. 기존 제약 조건 확인
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'diaries'::regclass
    AND contype = 'u';

-- 2. 기존 UNIQUE 제약 조건 제거 (date만 있는 경우)
ALTER TABLE diaries DROP CONSTRAINT IF EXISTS diaries_date_key;
ALTER TABLE diaries DROP CONSTRAINT IF EXISTS diaries_date_user_id_unique;

-- 3. 새로운 복합 UNIQUE 제약 조건 생성 (date, user_id)
ALTER TABLE diaries ADD CONSTRAINT diaries_date_user_id_unique UNIQUE(date, user_id);

-- 4. 제약 조건 확인
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'diaries'::regclass
    AND contype = 'u';

