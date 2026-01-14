-- 경조사 기록 테이블
CREATE TABLE IF NOT EXISTS congratulatory_money_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('축의금', '부조금')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  recipient_name TEXT NOT NULL,
  relationship TEXT,
  phone_number TEXT,
  event_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 청첩장 인원 테이블
CREATE TABLE IF NOT EXISTS wedding_invitation_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  relationship TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 축의금 받는 인원 테이블
CREATE TABLE IF NOT EXISTS congratulatory_money_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  relationship TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 정책 설정
ALTER TABLE congratulatory_money_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE wedding_invitation_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE congratulatory_money_recipients ENABLE ROW LEVEL SECURITY;

-- 경조사 기록 테이블 정책
CREATE POLICY "Users can view their own congratulatory money records"
  ON congratulatory_money_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own congratulatory money records"
  ON congratulatory_money_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own congratulatory money records"
  ON congratulatory_money_records FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own congratulatory money records"
  ON congratulatory_money_records FOR DELETE
  USING (auth.uid() = user_id);

-- 청첩장 인원 테이블 정책
CREATE POLICY "Users can view their own wedding invitation recipients"
  ON wedding_invitation_recipients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wedding invitation recipients"
  ON wedding_invitation_recipients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wedding invitation recipients"
  ON wedding_invitation_recipients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wedding invitation recipients"
  ON wedding_invitation_recipients FOR DELETE
  USING (auth.uid() = user_id);

-- 축의금 받는 인원 테이블 정책
CREATE POLICY "Users can view their own congratulatory money recipients"
  ON congratulatory_money_recipients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own congratulatory money recipients"
  ON congratulatory_money_recipients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own congratulatory money recipients"
  ON congratulatory_money_recipients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own congratulatory money recipients"
  ON congratulatory_money_recipients FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER update_congratulatory_money_records_updated_at
  BEFORE UPDATE ON congratulatory_money_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wedding_invitation_recipients_updated_at
  BEFORE UPDATE ON wedding_invitation_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_congratulatory_money_recipients_updated_at
  BEFORE UPDATE ON congratulatory_money_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
