-- 축의금/부조금 기록 테이블에 전화번호 컬럼 추가 및 경조사 유형, 메모 컬럼 제거
-- 경조사 유형과 메모는 더 이상 사용하지 않으므로 제거

-- 전화번호 컬럼 추가
ALTER TABLE congratulatory_money_records 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- 경조사 유형 컬럼 제거 (데이터 손실 주의)
ALTER TABLE congratulatory_money_records 
DROP COLUMN IF EXISTS event_type;

-- 메모 컬럼 제거 (데이터 손실 주의)
ALTER TABLE congratulatory_money_records 
DROP COLUMN IF EXISTS notes;
