-- 버킷리스트 상태 및 카테고리 제약조건 업데이트
-- 기존 테이블이 있는 경우 이 스크립트를 실행하여 제약조건을 업데이트하세요

-- 1. 상태 제약조건 업데이트
ALTER TABLE bucketlists DROP CONSTRAINT IF EXISTS bucketlists_status_check;
ALTER TABLE bucketlists ADD CONSTRAINT bucketlists_status_check 
  CHECK (status IN ('NOT_COMPLETED', 'COMPLETED'));
ALTER TABLE bucketlists ALTER COLUMN status SET DEFAULT 'NOT_COMPLETED';
UPDATE bucketlists 
SET status = 'NOT_COMPLETED' 
WHERE status IN ('SOMEDAY', 'PLANNING', 'IN_PROGRESS');

-- 2. 카테고리 제약조건 업데이트 (기타 제거)
ALTER TABLE bucketlists DROP CONSTRAINT IF EXISTS bucketlists_category_check;
ALTER TABLE bucketlists ADD CONSTRAINT bucketlists_category_check 
  CHECK (category IN ('TRAVEL', 'CAREER', 'HEALTH', 'RELATIONSHIP', 'HOBBY', 'LEARNING', 'FINANCIAL', 'EXPERIENCE'));
-- 기존 'OTHER' 카테고리를 'TRAVEL'로 변경
UPDATE bucketlists 
SET category = 'TRAVEL' 
WHERE category = 'OTHER';

