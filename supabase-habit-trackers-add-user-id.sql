-- Habit Tracker 테이블에 user_id 컬럼 추가 (기존 테이블 마이그레이션)

-- 1. habit_trackers 테이블에 user_id 컬럼 추가
ALTER TABLE habit_trackers 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. habit_tracker_days 테이블에 user_id 컬럼 추가
ALTER TABLE habit_tracker_days 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- 3. user_id 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_habit_trackers_user_id ON habit_trackers(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_tracker_days_user_id ON habit_tracker_days(user_id);

-- 4. 기존 데이터가 있다면 habit_trackers의 user_id를 habit_tracker_days에 복사
-- (habit_tracker_days의 user_id는 habit_trackers의 user_id와 동일해야 함)
UPDATE habit_tracker_days htd
SET user_id = ht.user_id
FROM habit_trackers ht
WHERE htd.habit_tracker_id = ht.id
  AND htd.user_id IS NULL
  AND ht.user_id IS NOT NULL;

-- 5. 기존 데이터가 있다면 NULL로 남겨두거나, 필요시 기본값 설정
-- (실제 사용 시에는 적절한 user_id로 업데이트 필요)

