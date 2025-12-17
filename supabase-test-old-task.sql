-- 일주일 이상 지난 테스트 할 일 생성
-- 이 스크립트는 Supabase SQL Editor에서 실행하세요

-- 8일 전에 생성된 테스트 할 일 (일주일 이상 지남)
INSERT INTO tasks (title, completed, istoday, category, createdat)
VALUES (
  '일주일 이상 지난 테스트 할 일',
  false,
  false,
  '작업',
  EXTRACT(EPOCH FROM (NOW() - INTERVAL '8 days')) * 1000
);

-- 10일 전에 생성된 테스트 할 일
INSERT INTO tasks (title, completed, istoday, category, createdat)
VALUES (
  '10일 전에 생성된 테스트 할 일',
  false,
  false,
  '공부',
  EXTRACT(EPOCH FROM (NOW() - INTERVAL '10 days')) * 1000
);

-- 14일 전에 생성된 테스트 할 일 (2주 전)
INSERT INTO tasks (title, completed, istoday, category, createdat)
VALUES (
  '2주 전에 생성된 테스트 할 일',
  false,
  true,
  '개인',
  EXTRACT(EPOCH FROM (NOW() - INTERVAL '14 days')) * 1000
);

-- 확인용: 생성된 테스트 데이터 조회
-- SELECT 
--   id,
--   title,
--   completed,
--   istoday,
--   category,
--   createdat,
--   to_timestamp(createdat / 1000) as created_date,
--   NOW() - to_timestamp(createdat / 1000) as age
-- FROM tasks
-- WHERE title LIKE '%테스트%'
-- ORDER BY createdat ASC;
