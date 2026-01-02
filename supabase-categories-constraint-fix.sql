-- categories 테이블의 UNIQUE 제약 조건 수정
-- "duplicate key value violates unique constraint categories_name_key" 오류 해결

-- 1. 기존 제약 조건 확인
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'categories'::regclass
    AND contype = 'u';

-- 2. 기존 UNIQUE 제약 조건 제거 (name만 있는 경우)
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;

-- 3. 새로운 복합 UNIQUE 제약 조건 생성 (name, user_id)
-- 이미 존재하면 에러가 나지 않도록 IF NOT EXISTS는 없지만, DROP 후 생성하므로 안전
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_user_id_unique;
ALTER TABLE categories ADD CONSTRAINT categories_name_user_id_unique UNIQUE(name, user_id);

-- 4. 제약 조건 확인
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'categories'::regclass
    AND contype = 'u';

