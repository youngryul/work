/** 할 일 완료 시 젤리 보상 */
export const JELLY_REWARD_TASK_COMPLETE = 1

/** 일기 작성 시 젤리 보상 (날짜당 1회) */
export const JELLY_REWARD_DIARY_WRITE = 5

/** 몸무게 기록 시 젤리 보상 (날짜당 1회) */
export const JELLY_REWARD_WEIGHT_RECORD = 2

/** 목표 몸무게 달성 시 젤리 보상 (1회) */
export const JELLY_REWARD_WEIGHT_GOAL_REACHED = 10

/** 오늘 5년 질문 최초 답변 시 젤리 보상 (하루 1회) */
export const JELLY_REWARD_FIVE_YEAR_ANSWER = 3

/** 오늘 외 날짜 5년 질문 최초 답변 시 젤리 보상 (질문·연도당 1회) */
export const JELLY_REWARD_FIVE_YEAR_ANSWER_OTHER = 1

/** 습관 트래커 오늘 최초 달성 시 젤리 보상 (트래커·날짜당 1회) */
export const JELLY_REWARD_HABIT_TRACKER_FIRST_TODAY = 2

/** 습관 트래커 오늘 외 날짜 최초 달성 시 젤리 보상 (트래커·날짜당 1회) */
export const JELLY_REWARD_HABIT_TRACKER_OTHER = 1

/** 레시피 최초 등록 시 젤리 보상 (레시피당 1회) */
export const JELLY_REWARD_RECIPE_CREATE = 5

/** 타이머/뽀모도로 10분당 젤리 보상 */
export const JELLY_REWARD_STUDY_TIMER_PER_10_MIN = 1

/** 타이머 젤리 산정 단위 (초) — 10분 */
export const STUDY_TIMER_JELLY_INTERVAL_SECONDS = 600

/**
 * 타이머 기록 초 → 지급 젤리 수 (10분당 1개, 미만은 0)
 * @param {number} durationSeconds
 * @returns {number}
 */
export function calcStudyTimerJellyAmount(durationSeconds) {
  const seconds = Math.max(0, Math.floor(Number(durationSeconds) || 0))
  return Math.floor(seconds / STUDY_TIMER_JELLY_INTERVAL_SECONDS) * JELLY_REWARD_STUDY_TIMER_PER_10_MIN
}

/** 젤리 지급 사유 */
export const JELLY_REWARD_REASON = {
  TASK_COMPLETE: 'task_complete',
  DIARY_WRITE: 'diary_write',
  WEIGHT_RECORD: 'weight_record',
  WEIGHT_GOAL_REACHED: 'weight_goal_reached',
  FIVE_YEAR_ANSWER: 'five_year_answer',
  HABIT_TRACKER_FIRST_TODAY: 'habit_tracker_first_today',
  RECIPE_CREATE: 'recipe_create',
  STUDY_TIMER: 'study_timer',
}
