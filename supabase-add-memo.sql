-- memo 컬럼 추가 마이그레이션
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS memo TEXT;
