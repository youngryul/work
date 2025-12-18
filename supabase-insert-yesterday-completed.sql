-- 어제 날짜로 완료된 할 일 신규 추가 SQL
-- 이 스크립트는 Supabase SQL Editor에서 실행하세요

-- ============================================
-- 1. 어제 완료된 할 일 1개 추가
-- ============================================
-- 사용법: '할 일 제목'을 실제 제목으로 변경하세요
INSERT INTO tasks (title, completed, istoday, category, createdat, completedat)
VALUES (
  '할 일 제목',
  true,
  false,
  '작업',
  EXTRACT(EPOCH FROM (NOW() - INTERVAL '2 days')) * 1000,  -- 2일 전에 생성
  EXTRACT(EPOCH FROM (NOW() - INTERVAL '1 day')) * 1000   -- 어제 완료
);

-- ============================================
-- 2. 어제 완료된 할 일 여러 개 추가
-- ============================================
INSERT INTO tasks (title, completed, istoday, category, createdat, completedat)
VALUES 
  (
    '어제 완료한 할 일 1',
    true,
    false,
    '작업',
    EXTRACT(EPOCH FROM (NOW() - INTERVAL '3 days')) * 1000,
    EXTRACT(EPOCH FROM (NOW() - INTERVAL '1 day')) * 1000
  ),
  (
    '어제 완료한 할 일 2',
    true,
    false,
    '공부',
    EXTRACT(EPOCH FROM (NOW() - INTERVAL '5 days')) * 1000,
    EXTRACT(EPOCH FROM (NOW() - INTERVAL '1 day')) * 1000
  ),
  (
    '어제 완료한 할 일 3',
    true,
    false,
    '개인',
    EXTRACT(EPOCH FROM (NOW() - INTERVAL '2 days')) * 1000,
    EXTRACT(EPOCH FROM (NOW() - INTERVAL '1 day')) * 1000
  );

-- ============================================
-- 3. 어제 오늘 할 일로 설정되어 있던 항목 추가 (완료됨)
-- ============================================
INSERT INTO tasks (title, completed, istoday, category, createdat, completedat)
VALUES (
  '어제 오늘 할 일로 완료한 항목',
  true,
  false,  -- 리셋 후 백로그로 이동했으므로 false
  '작업',
  EXTRACT(EPOCH FROM (NOW() - INTERVAL '2 days')) * 1000,
  EXTRACT(EPOCH FROM (NOW() - INTERVAL '1 day')) * 1000
);

-- ============================================
-- 4. 어제 특정 시간에 완료된 항목 추가
-- ============================================
-- 사용법: 시간을 조정하려면 INTERVAL을 변경하세요
-- 예: '1 day 14 hours' = 어제 오후 2시
INSERT INTO tasks (title, completed, istoday, category, createdat, completedat)
VALUES (
  '어제 오후에 완료한 할 일',
  true,
  false,
  '작업',
  EXTRACT(EPOCH FROM (NOW() - INTERVAL '2 days')) * 1000,
  EXTRACT(EPOCH FROM (NOW() - INTERVAL '1 day 14 hours')) * 1000  -- 어제 오후 2시
);

-- ============================================
-- 5. 확인 쿼리 (추가 후 확인)
-- ============================================
-- SELECT 
--   id,
--   title,
--   completed,
--   istoday,
--   category,
--   to_timestamp(createdat / 1000) as created_date,
--   to_timestamp(completedat / 1000) as completed_date
-- FROM tasks
-- WHERE DATE(to_timestamp(completedat / 1000)) = DATE(NOW() - INTERVAL '1 day')
-- ORDER BY completedat DESC;

