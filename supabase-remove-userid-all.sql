-- 모든 테이블에서 user_id 제거
-- 기존 테이블이 있는 경우 이 스크립트를 실행하여 user_id를 제거하세요

-- 1. 버킷리스트 테이블
DROP INDEX IF EXISTS idx_bucketlists_user_id;
ALTER TABLE bucketlists ALTER COLUMN user_id DROP NOT NULL;
-- 완전히 제거하려면: ALTER TABLE bucketlists DROP COLUMN IF EXISTS user_id;

-- 2. 업무일지 테이블
DROP INDEX IF EXISTS idx_work_reports_user_id;
ALTER TABLE work_reports ALTER COLUMN user_id DROP NOT NULL;
-- UNIQUE 제약조건 수정
ALTER TABLE work_reports DROP CONSTRAINT IF EXISTS work_reports_user_id_date_key;
ALTER TABLE work_reports ADD CONSTRAINT work_reports_date_key UNIQUE(date);
-- 완전히 제거하려면: ALTER TABLE work_reports DROP COLUMN IF EXISTS user_id;

-- 3. 목표 관리 테이블
DROP INDEX IF EXISTS idx_yearly_goals_user_year;
ALTER TABLE yearly_goals ALTER COLUMN user_id DROP NOT NULL;
-- UNIQUE 제약조건 수정
ALTER TABLE yearly_goals DROP CONSTRAINT IF EXISTS yearly_goals_user_id_year_category_key;
ALTER TABLE yearly_goals ADD CONSTRAINT yearly_goals_year_category_key UNIQUE(year, category);
-- 완전히 제거하려면: ALTER TABLE yearly_goals DROP COLUMN IF EXISTS user_id;

