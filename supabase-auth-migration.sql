-- 로그인 기능 추가를 위한 데이터베이스 마이그레이션 스크립트
-- 기존 데이터에 user_id를 추가하고 인증 시스템을 구축합니다.

-- ============================================
-- 1단계: 기존 데이터 백업 확인 (수동으로 확인 필요)
-- ============================================
-- 이 스크립트를 실행하기 전에 데이터베이스를 백업하세요.

-- ============================================
-- 2단계: UNIQUE 제약 조건 수정 (user_id 포함)
-- ============================================

-- diaries 테이블: date만 UNIQUE에서 (date, user_id) 조합으로 변경
ALTER TABLE diaries DROP CONSTRAINT IF EXISTS diaries_date_key;
ALTER TABLE diaries ADD CONSTRAINT diaries_date_user_id_unique UNIQUE(date, user_id);

-- monthly_reflections 테이블: (year, month)만 UNIQUE에서 (year, month, user_id) 조합으로 변경
ALTER TABLE monthly_reflections DROP CONSTRAINT IF EXISTS monthly_reflections_year_month_key;
ALTER TABLE monthly_reflections ADD CONSTRAINT monthly_reflections_year_month_user_id_unique UNIQUE(year, month, user_id);

-- yearly_goals 테이블: (year, category)만 UNIQUE에서 (year, category, user_id) 조합으로 변경
ALTER TABLE yearly_goals DROP CONSTRAINT IF EXISTS yearly_goals_year_category_key;
ALTER TABLE yearly_goals ADD CONSTRAINT yearly_goals_year_category_user_id_unique UNIQUE(year, category, user_id);

-- monthly_goals 테이블: (yearly_goal_id, year, month)만 UNIQUE에서 (yearly_goal_id, year, month, user_id) 조합으로 변경
ALTER TABLE monthly_goals DROP CONSTRAINT IF EXISTS monthly_goals_yearly_goal_id_year_month_key;
ALTER TABLE monthly_goals ADD CONSTRAINT monthly_goals_yearly_goal_id_year_month_user_id_unique UNIQUE(yearly_goal_id, year, month, user_id);

-- daily_checks 테이블: (date, content)만 UNIQUE에서 (date, content, user_id) 조합으로 변경
ALTER TABLE daily_checks DROP CONSTRAINT IF EXISTS daily_checks_date_content_key;
ALTER TABLE daily_checks ADD CONSTRAINT daily_checks_date_content_user_id_unique UNIQUE(date, content, user_id);

-- categories 테이블: name만 UNIQUE에서 (name, user_id) 조합으로 변경
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE categories ADD CONSTRAINT categories_name_user_id_unique UNIQUE(name, user_id);

-- weekly_work_reports 테이블: (week_start, week_end)만 UNIQUE에서 (week_start, week_end, user_id) 조합으로 변경
ALTER TABLE weekly_work_reports DROP CONSTRAINT IF EXISTS weekly_work_reports_week_start_week_end_key;
ALTER TABLE weekly_work_reports ADD CONSTRAINT weekly_work_reports_week_start_week_end_user_id_unique UNIQUE(week_start, week_end, user_id);

-- monthly_work_reports 테이블: (year, month)만 UNIQUE에서 (year, month, user_id) 조합으로 변경
ALTER TABLE monthly_work_reports DROP CONSTRAINT IF EXISTS monthly_work_reports_year_month_key;
ALTER TABLE monthly_work_reports ADD CONSTRAINT monthly_work_reports_year_month_user_id_unique UNIQUE(year, month, user_id);

-- weekly_diary_summaries 테이블: (week_start, week_end)만 UNIQUE에서 (week_start, week_end, user_id) 조합으로 변경
ALTER TABLE weekly_diary_summaries DROP CONSTRAINT IF EXISTS weekly_diary_summaries_week_start_week_end_key;
ALTER TABLE weekly_diary_summaries ADD CONSTRAINT weekly_diary_summaries_week_start_week_end_user_id_unique UNIQUE(week_start, week_end, user_id);

-- monthly_diary_summaries 테이블: (year, month)만 UNIQUE에서 (year, month, user_id) 조합으로 변경
ALTER TABLE monthly_diary_summaries DROP CONSTRAINT IF EXISTS monthly_diary_summaries_year_month_key;
ALTER TABLE monthly_diary_summaries ADD CONSTRAINT monthly_diary_summaries_year_month_user_id_unique UNIQUE(year, month, user_id);

-- work_reports 테이블: date만 UNIQUE에서 (date, user_id) 조합으로 변경
ALTER TABLE work_reports DROP CONSTRAINT IF EXISTS work_reports_date_key;
ALTER TABLE work_reports ADD CONSTRAINT work_reports_date_user_id_unique UNIQUE(date, user_id);

-- ============================================
-- 3단계: 모든 테이블에 user_id 컬럼 추가
-- ============================================

-- tasks 테이블에 user_id 추가
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- work_reports 테이블에 user_id 추가
ALTER TABLE work_reports 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- diaries 테이블에 user_id 추가
ALTER TABLE diaries 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- project_records 테이블에 user_id 추가
ALTER TABLE project_records 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- reading_records 테이블에 user_id 추가
ALTER TABLE reading_records 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- books 테이블에 user_id 추가
ALTER TABLE books 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- yearly_goals 테이블에 user_id 추가
ALTER TABLE yearly_goals 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- monthly_goals 테이블에 user_id 추가
ALTER TABLE monthly_goals 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- weekly_actions 테이블에 user_id 추가
ALTER TABLE weekly_actions 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- daily_checks 테이블에 user_id 추가
ALTER TABLE daily_checks 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- monthly_reflections 테이블에 user_id 추가
ALTER TABLE monthly_reflections 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- weekly_work_reports 테이블에 user_id 추가
ALTER TABLE weekly_work_reports 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- monthly_work_reports 테이블에 user_id 추가
ALTER TABLE monthly_work_reports 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- weekly_diary_summaries 테이블에 user_id 추가
ALTER TABLE weekly_diary_summaries 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- monthly_diary_summaries 테이블에 user_id 추가
ALTER TABLE monthly_diary_summaries 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- annual_review 테이블에 user_id 추가
ALTER TABLE annual_review 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- categories 테이블에 user_id 추가
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- bucketlists 테이블은 이미 user_id가 있지만, 외래 키 제약 조건 추가
ALTER TABLE bucketlists 
DROP CONSTRAINT IF EXISTS bucketlists_user_id_fkey;
ALTER TABLE bucketlists 
ADD CONSTRAINT bucketlists_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================
-- 3단계: 기존 데이터에 기본 user_id 할당
-- ============================================
-- 주의: 이 부분은 실제 첫 번째 사용자 ID로 교체해야 합니다.
-- 방법 1: 첫 번째 로그인한 사용자에게 모든 기존 데이터 할당
-- 방법 2: 임시 UUID를 생성하여 할당 후, 로그인 시 마이그레이션

-- 기존 데이터에 기본 user_id를 할당하는 함수
-- 이 함수는 첫 번째 사용자가 로그인할 때 실행하거나,
-- 관리자가 수동으로 실행할 수 있습니다.
CREATE OR REPLACE FUNCTION assign_existing_data_to_user(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- 각 테이블의 기존 데이터에 user_id 할당
  UPDATE tasks SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE work_reports SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE diaries SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE project_records SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE reading_records SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE books SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE yearly_goals SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE monthly_goals SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE weekly_actions SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE daily_checks SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE monthly_reflections SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE weekly_work_reports SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE monthly_work_reports SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE weekly_diary_summaries SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE monthly_diary_summaries SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE annual_review SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE categories SET user_id = target_user_id WHERE user_id IS NULL;
  UPDATE bucketlists SET user_id = target_user_id WHERE user_id IS NULL OR user_id NOT IN (SELECT id FROM auth.users);
  
  -- 기본 카테고리가 없으면 생성
  INSERT INTO categories (name, emoji, user_id)
  VALUES 
    ('작업', '💻', target_user_id),
    ('공부', '📚', target_user_id),
    ('생각', '🧠', target_user_id),
    ('개인', '❤️', target_user_id)
  ON CONFLICT (name, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4단계: user_id 컬럼을 NOT NULL로 변경 (선택사항)
-- ============================================
-- 기존 데이터 마이그레이션이 완료된 후 실행하세요.
-- 주의: 이 단계는 기존 데이터가 모두 할당된 후에만 실행해야 합니다.

-- 예시 (실제로는 마이그레이션 완료 후 실행):
-- ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE work_reports ALTER COLUMN user_id SET NOT NULL;
-- ... (각 테이블마다 반복)

-- ============================================
-- 5단계: 인덱스 추가 (성능 최적화)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_work_reports_user_id ON work_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_diaries_user_id ON diaries(user_id);
CREATE INDEX IF NOT EXISTS idx_project_records_user_id ON project_records(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_records_user_id ON reading_records(user_id);
CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_yearly_goals_user_id ON yearly_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_goals_user_id ON monthly_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_actions_user_id ON weekly_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_checks_user_id ON daily_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_reflections_user_id ON monthly_reflections(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_work_reports_user_id ON weekly_work_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_work_reports_user_id ON monthly_work_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_diary_summaries_user_id ON weekly_diary_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_diary_summaries_user_id ON monthly_diary_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_annual_review_user_id ON annual_review(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- ============================================
-- 6단계: Row Level Security (RLS) 정책 설정
-- ============================================

-- tasks 테이블 RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;

CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- work_reports 테이블 RLS
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own work_reports" ON work_reports;
DROP POLICY IF EXISTS "Users can insert own work_reports" ON work_reports;
DROP POLICY IF EXISTS "Users can update own work_reports" ON work_reports;
DROP POLICY IF EXISTS "Users can delete own work_reports" ON work_reports;

CREATE POLICY "Users can view own work_reports" ON work_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own work_reports" ON work_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own work_reports" ON work_reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own work_reports" ON work_reports
  FOR DELETE USING (auth.uid() = user_id);

-- diaries 테이블 RLS
ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own diaries" ON diaries;
DROP POLICY IF EXISTS "Users can insert own diaries" ON diaries;
DROP POLICY IF EXISTS "Users can update own diaries" ON diaries;
DROP POLICY IF EXISTS "Users can delete own diaries" ON diaries;

CREATE POLICY "Users can view own diaries" ON diaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diaries" ON diaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own diaries" ON diaries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own diaries" ON diaries
  FOR DELETE USING (auth.uid() = user_id);

-- project_records 테이블 RLS
ALTER TABLE project_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own project_records" ON project_records;
DROP POLICY IF EXISTS "Users can insert own project_records" ON project_records;
DROP POLICY IF EXISTS "Users can update own project_records" ON project_records;
DROP POLICY IF EXISTS "Users can delete own project_records" ON project_records;

CREATE POLICY "Users can view own project_records" ON project_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own project_records" ON project_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own project_records" ON project_records
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own project_records" ON project_records
  FOR DELETE USING (auth.uid() = user_id);

-- reading_records 테이블 RLS
ALTER TABLE reading_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own reading_records" ON reading_records;
DROP POLICY IF EXISTS "Users can insert own reading_records" ON reading_records;
DROP POLICY IF EXISTS "Users can update own reading_records" ON reading_records;
DROP POLICY IF EXISTS "Users can delete own reading_records" ON reading_records;

CREATE POLICY "Users can view own reading_records" ON reading_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reading_records" ON reading_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reading_records" ON reading_records
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reading_records" ON reading_records
  FOR DELETE USING (auth.uid() = user_id);

-- books 테이블 RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own books" ON books;
DROP POLICY IF EXISTS "Users can insert own books" ON books;
DROP POLICY IF EXISTS "Users can update own books" ON books;
DROP POLICY IF EXISTS "Users can delete own books" ON books;

CREATE POLICY "Users can view own books" ON books
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own books" ON books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own books" ON books
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own books" ON books
  FOR DELETE USING (auth.uid() = user_id);

-- yearly_goals 테이블 RLS
ALTER TABLE yearly_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own yearly_goals" ON yearly_goals;
DROP POLICY IF EXISTS "Users can insert own yearly_goals" ON yearly_goals;
DROP POLICY IF EXISTS "Users can update own yearly_goals" ON yearly_goals;
DROP POLICY IF EXISTS "Users can delete own yearly_goals" ON yearly_goals;

CREATE POLICY "Users can view own yearly_goals" ON yearly_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own yearly_goals" ON yearly_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own yearly_goals" ON yearly_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own yearly_goals" ON yearly_goals
  FOR DELETE USING (auth.uid() = user_id);

-- monthly_goals 테이블 RLS
ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own monthly_goals" ON monthly_goals;
DROP POLICY IF EXISTS "Users can insert own monthly_goals" ON monthly_goals;
DROP POLICY IF EXISTS "Users can update own monthly_goals" ON monthly_goals;
DROP POLICY IF EXISTS "Users can delete own monthly_goals" ON monthly_goals;

CREATE POLICY "Users can view own monthly_goals" ON monthly_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monthly_goals" ON monthly_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly_goals" ON monthly_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly_goals" ON monthly_goals
  FOR DELETE USING (auth.uid() = user_id);

-- weekly_actions 테이블 RLS
ALTER TABLE weekly_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own weekly_actions" ON weekly_actions;
DROP POLICY IF EXISTS "Users can insert own weekly_actions" ON weekly_actions;
DROP POLICY IF EXISTS "Users can update own weekly_actions" ON weekly_actions;
DROP POLICY IF EXISTS "Users can delete own weekly_actions" ON weekly_actions;

CREATE POLICY "Users can view own weekly_actions" ON weekly_actions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly_actions" ON weekly_actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly_actions" ON weekly_actions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly_actions" ON weekly_actions
  FOR DELETE USING (auth.uid() = user_id);

-- daily_checks 테이블 RLS
ALTER TABLE daily_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own daily_checks" ON daily_checks;
DROP POLICY IF EXISTS "Users can insert own daily_checks" ON daily_checks;
DROP POLICY IF EXISTS "Users can update own daily_checks" ON daily_checks;
DROP POLICY IF EXISTS "Users can delete own daily_checks" ON daily_checks;

CREATE POLICY "Users can view own daily_checks" ON daily_checks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily_checks" ON daily_checks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily_checks" ON daily_checks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily_checks" ON daily_checks
  FOR DELETE USING (auth.uid() = user_id);

-- monthly_reflections 테이블 RLS
ALTER TABLE monthly_reflections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own monthly_reflections" ON monthly_reflections;
DROP POLICY IF EXISTS "Users can insert own monthly_reflections" ON monthly_reflections;
DROP POLICY IF EXISTS "Users can update own monthly_reflections" ON monthly_reflections;
DROP POLICY IF EXISTS "Users can delete own monthly_reflections" ON monthly_reflections;

CREATE POLICY "Users can view own monthly_reflections" ON monthly_reflections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monthly_reflections" ON monthly_reflections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly_reflections" ON monthly_reflections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly_reflections" ON monthly_reflections
  FOR DELETE USING (auth.uid() = user_id);

-- weekly_work_reports 테이블 RLS
ALTER TABLE weekly_work_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own weekly_work_reports" ON weekly_work_reports;
DROP POLICY IF EXISTS "Users can insert own weekly_work_reports" ON weekly_work_reports;
DROP POLICY IF EXISTS "Users can update own weekly_work_reports" ON weekly_work_reports;
DROP POLICY IF EXISTS "Users can delete own weekly_work_reports" ON weekly_work_reports;

CREATE POLICY "Users can view own weekly_work_reports" ON weekly_work_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly_work_reports" ON weekly_work_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly_work_reports" ON weekly_work_reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly_work_reports" ON weekly_work_reports
  FOR DELETE USING (auth.uid() = user_id);

-- monthly_work_reports 테이블 RLS
ALTER TABLE monthly_work_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own monthly_work_reports" ON monthly_work_reports;
DROP POLICY IF EXISTS "Users can insert own monthly_work_reports" ON monthly_work_reports;
DROP POLICY IF EXISTS "Users can update own monthly_work_reports" ON monthly_work_reports;
DROP POLICY IF EXISTS "Users can delete own monthly_work_reports" ON monthly_work_reports;

CREATE POLICY "Users can view own monthly_work_reports" ON monthly_work_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monthly_work_reports" ON monthly_work_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly_work_reports" ON monthly_work_reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly_work_reports" ON monthly_work_reports
  FOR DELETE USING (auth.uid() = user_id);

-- weekly_diary_summaries 테이블 RLS
ALTER TABLE weekly_diary_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own weekly_diary_summaries" ON weekly_diary_summaries;
DROP POLICY IF EXISTS "Users can insert own weekly_diary_summaries" ON weekly_diary_summaries;
DROP POLICY IF EXISTS "Users can update own weekly_diary_summaries" ON weekly_diary_summaries;
DROP POLICY IF EXISTS "Users can delete own weekly_diary_summaries" ON weekly_diary_summaries;

CREATE POLICY "Users can view own weekly_diary_summaries" ON weekly_diary_summaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly_diary_summaries" ON weekly_diary_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly_diary_summaries" ON weekly_diary_summaries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weekly_diary_summaries" ON weekly_diary_summaries
  FOR DELETE USING (auth.uid() = user_id);

-- monthly_diary_summaries 테이블 RLS
ALTER TABLE monthly_diary_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own monthly_diary_summaries" ON monthly_diary_summaries;
DROP POLICY IF EXISTS "Users can insert own monthly_diary_summaries" ON monthly_diary_summaries;
DROP POLICY IF EXISTS "Users can update own monthly_diary_summaries" ON monthly_diary_summaries;
DROP POLICY IF EXISTS "Users can delete own monthly_diary_summaries" ON monthly_diary_summaries;

CREATE POLICY "Users can view own monthly_diary_summaries" ON monthly_diary_summaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monthly_diary_summaries" ON monthly_diary_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly_diary_summaries" ON monthly_diary_summaries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly_diary_summaries" ON monthly_diary_summaries
  FOR DELETE USING (auth.uid() = user_id);

-- bucketlists 테이블 RLS (이미 있지만 업데이트)
ALTER TABLE bucketlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own bucketlists" ON bucketlists;
DROP POLICY IF EXISTS "Users can insert own bucketlists" ON bucketlists;
DROP POLICY IF EXISTS "Users can update own bucketlists" ON bucketlists;
DROP POLICY IF EXISTS "Users can delete own bucketlists" ON bucketlists;

CREATE POLICY "Users can view own bucketlists" ON bucketlists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bucketlists" ON bucketlists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bucketlists" ON bucketlists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bucketlists" ON bucketlists
  FOR DELETE USING (auth.uid() = user_id);

-- annual_review 테이블 RLS
ALTER TABLE annual_review ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own annual_review" ON annual_review;
DROP POLICY IF EXISTS "Users can insert own annual_review" ON annual_review;
DROP POLICY IF EXISTS "Users can update own annual_review" ON annual_review;
DROP POLICY IF EXISTS "Users can delete own annual_review" ON annual_review;

CREATE POLICY "Users can view own annual_review" ON annual_review
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own annual_review" ON annual_review
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own annual_review" ON annual_review
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own annual_review" ON annual_review
  FOR DELETE USING (auth.uid() = user_id);

-- categories 테이블 RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations" ON categories;
DROP POLICY IF EXISTS "Users can view own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
DROP POLICY IF EXISTS "Users can update own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON categories;

CREATE POLICY "Users can view own categories" ON categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" ON categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON categories
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 사용 방법
-- ============================================
-- 1. 이 스크립트를 Supabase SQL Editor에서 실행합니다.
-- 2. 첫 번째 사용자가 로그인한 후, 다음 쿼리를 실행하여 기존 데이터를 할당합니다:
--    SELECT assign_existing_data_to_user(auth.uid());
-- 3. 또는 관리자가 특정 사용자 ID로 할당:
--    SELECT assign_existing_data_to_user('사용자-UUID-여기');
-- 4. 마이그레이션이 완료되면 user_id를 NOT NULL로 변경할 수 있습니다.

