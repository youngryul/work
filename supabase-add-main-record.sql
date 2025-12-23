-- 프로젝트별 메인 기록 기능 추가
-- is_main 필드 추가

-- 1. is_main 컬럼 추가
ALTER TABLE project_records 
ADD COLUMN IF NOT EXISTS is_main BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. 인덱스 생성 (프로젝트별 메인 기록 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_project_records_is_main ON project_records(projectname, is_main) 
WHERE is_main = TRUE;

-- 3. 프로젝트별 메인 기록 유니크 제약조건 (하나의 프로젝트에 하나의 메인 기록만)
-- 주의: 기존에 여러 메인 기록이 있을 수 있으므로, 먼저 정리 후 제약조건 추가
-- 또는 애플리케이션 레벨에서 처리

-- 4. 기존 데이터 정리 (선택사항): 각 프로젝트의 첫 번째 기록을 메인으로 설정
-- UPDATE project_records pr1
-- SET is_main = TRUE
-- WHERE NOT EXISTS (
--   SELECT 1 FROM project_records pr2 
--   WHERE pr2.projectname = pr1.projectname 
--   AND pr2.is_main = TRUE
-- )
-- AND pr1.id = (
--   SELECT id FROM project_records pr3
--   WHERE pr3.projectname = pr1.projectname
--   ORDER BY pr3.createdat ASC
--   LIMIT 1
-- );
