-- 축의금 받은 기록 테이블에서 경조사 날짜, 경조사 유형, 메모 컬럼 제거
-- 이름, 관계, 금액만 남김

-- 경조사 날짜 컬럼 제거 (데이터 손실 주의)
ALTER TABLE congratulatory_money_recipients 
DROP COLUMN IF EXISTS event_date;

-- 경조사 유형 컬럼 제거 (데이터 손실 주의)
ALTER TABLE congratulatory_money_recipients 
DROP COLUMN IF EXISTS event_type;

-- 메모 컬럼 제거 (데이터 손실 주의)
ALTER TABLE congratulatory_money_recipients 
DROP COLUMN IF EXISTS notes;
