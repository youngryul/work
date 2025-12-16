-- categories 테이블 생성
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  emoji TEXT NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- Row Level Security (RLS) 설정
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 접근 가능하도록 정책 설정
CREATE POLICY "Allow all operations" ON categories
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 기본 카테고리 데이터 삽입
INSERT INTO categories (name, emoji)
VALUES 
  ('작업', '💻'),
  ('공부', '📚'),
  ('생각', '🧠'),
  ('개인', '❤️')
ON CONFLICT (name) DO NOTHING;

