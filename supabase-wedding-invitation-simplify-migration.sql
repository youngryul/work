-- 청첩장 인원 테이블에서 전화번호, 주소, 돌린 날짜, 메모 컬럼 제거
-- 이름과 관계만 남김

-- 전화번호 컬럼 제거 (데이터 손실 주의)
ALTER TABLE wedding_invitation_recipients 
DROP COLUMN IF EXISTS phone_number;

-- 주소 컬럼 제거 (데이터 손실 주의)
ALTER TABLE wedding_invitation_recipients 
DROP COLUMN IF EXISTS address;

-- 돌린 날짜 컬럼 제거 (데이터 손실 주의)
ALTER TABLE wedding_invitation_recipients 
DROP COLUMN IF EXISTS sent_date;

-- 메모 컬럼 제거 (데이터 손실 주의)
ALTER TABLE wedding_invitation_recipients 
DROP COLUMN IF EXISTS notes;
