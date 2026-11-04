/**
 * 월별 목표 · 습관 트래커 진행률 계산 유틸
 * (화면 · 트래커 카드 · 10일 점검 알림이 같은 계산을 쓰도록 한곳에 모음)
 */
import { getDaysInMonth } from '../constants/habitTracker.js'
import { MONTHLY_GOAL_STATUS } from '../constants/goalCategories.js'

/** 10일 점검 알림 기준일 (말일은 월마다 다르므로 별도 계산) */
export const MONTHLY_GOAL_CHECKPOINT_DAYS = [10, 20]

/**
 * 해당 월에서 오늘까지 지난 날 수 (지난달이면 전체, 미래 달이면 0)
 * @param {number} year
 * @param {number} month - 1~12
 * @param {Date} [today]
 * @returns {number}
 */
export function getElapsedDays(year, month, today = new Date()) {
  const totalDays = getDaysInMonth(year, month)
  const ty = today.getFullYear()
  const tm = today.getMonth() + 1
  if (year < ty || (year === ty && month < tm)) return totalDays
  if (year > ty || (year === ty && month > tm)) return 0
  return Math.min(today.getDate(), totalDays)
}

/**
 * 체크된 날짜 집합 (1~31)
 * @param {Array<{day:number,isCompleted:boolean}>} days
 * @returns {Set<number>}
 */
function getCheckedDaySet(days = []) {
  return new Set(days.filter((d) => d.isCompleted).map((d) => d.day))
}

/**
 * 연속 달성 스트릭 (해당 월 안에서만 계산)
 * - current: 오늘(또는 아직 오늘 체크 전이면 어제)부터 거꾸로 이어진 연속 일수
 * - best: 이번 달 최장 연속 일수
 * @param {Array} days - tracker.days
 * @param {number} year
 * @param {number} month
 * @param {Date} [today]
 * @returns {{ current: number, best: number }}
 */
export function getHabitStreak(days, year, month, today = new Date()) {
  const checked = getCheckedDaySet(days)
  const elapsed = getElapsedDays(year, month, today)

  let best = 0
  let run = 0
  for (let day = 1; day <= elapsed; day += 1) {
    run = checked.has(day) ? run + 1 : 0
    best = Math.max(best, run)
  }

  // 오늘 아직 체크 안 했으면 어제까지의 연속도 '진행 중'으로 인정
  let cursor = checked.has(elapsed) ? elapsed : elapsed - 1
  let current = 0
  while (cursor >= 1 && checked.has(cursor)) {
    current += 1
    cursor -= 1
  }

  return { current, best }
}

/**
 * 습관 진행 상황
 * - checkedDays: 오늘까지 체크한 날 수
 * - elapsedDays: 오늘까지 지난 날 수 (= 매일 하면 기대되는 체크 수)
 * - paceRate: 오늘까지 기준 실천율 (체크 / 지난 날)
 * - monthRate: 한 달 전체 기준 달성률 (체크 / 말일)
 * @param {Object} tracker - { days }
 * @param {number} year
 * @param {number} month
 * @param {Date} [today]
 */
export function getHabitProgress(tracker, year, month, today = new Date()) {
  const totalDays = getDaysInMonth(year, month)
  const elapsedDays = getElapsedDays(year, month, today)
  const checked = getCheckedDaySet(tracker?.days)
  const checkedDays = [...checked].filter((day) => day <= elapsedDays).length

  return {
    totalDays,
    elapsedDays,
    checkedDays,
    paceRate: elapsedDays > 0 ? Math.round((checkedDays / elapsedDays) * 100) : 0,
    monthRate: totalDays > 0 ? Math.round((checkedDays / totalDays) * 100) : 0,
  }
}

/**
 * 페이스 상태 라벨 (실천율 기준)
 * @param {number} paceRate - 0~100
 * @returns {{ label: string, tone: 'good'|'ok'|'low' }}
 */
export function getPaceStatus(paceRate) {
  if (paceRate >= 80) return { label: '순항 중', tone: 'good' }
  if (paceRate >= 50) return { label: '조금만 더', tone: 'ok' }
  return { label: '다시 시동 걸기', tone: 'low' }
}

/**
 * 목표 하나의 달성률
 * - 완료 처리된 목표: 100
 * - 습관 트래커가 있으면: 트래커들의 오늘까지 실천율 평균
 * - 그 외: 0 (진행 중)
 * @param {Object} goal - { status, habitTrackers }
 * @param {number} year
 * @param {number} month
 * @param {Date} [today]
 * @returns {number}
 */
export function getGoalAchievementRate(goal, year, month, today = new Date()) {
  if (goal.status === MONTHLY_GOAL_STATUS.COMPLETED) return 100
  const trackers = goal.habitTrackers || []
  if (trackers.length === 0) return 0
  const sum = trackers.reduce(
    (acc, tracker) => acc + getHabitProgress(tracker, year, month, today).paceRate,
    0,
  )
  return Math.round(sum / trackers.length)
}

/**
 * 월별 목표 목록 전체 요약 (알림 · 회고 추천 달성률에 사용)
 * @param {Array} goals - habitTrackers가 붙은 목표 목록
 * @param {number} year
 * @param {number} month
 * @param {Date} [today]
 */
export function summarizeMonthlyGoals(goals, year, month, today = new Date()) {
  const items = goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    isCompleted: goal.status === MONTHLY_GOAL_STATUS.COMPLETED,
    achievementRate: getGoalAchievementRate(goal, year, month, today),
    habits: (goal.habitTrackers || []).map((tracker) => ({
      id: tracker.id,
      title: tracker.title,
      ...getHabitProgress(tracker, year, month, today),
      streak: getHabitStreak(tracker.days, year, month, today).current,
    })),
  }))

  const completedCount = items.filter((item) => item.isCompleted).length
  const overallRate = items.length > 0
    ? Math.round(items.reduce((acc, item) => acc + item.achievementRate, 0) / items.length)
    : 0

  return { items, completedCount, totalCount: items.length, overallRate }
}

/**
 * 오늘 기준 가장 최근의 점검일 (10일 · 20일 · 말일)
 * 점검일 당일을 놓쳐도 다음 점검일 전까지는 같은 점검일로 본다.
 * @param {Date} [today]
 * @returns {{ year: number, month: number, checkpoint: number, isMonthEnd: boolean } | null}
 */
export function getCurrentCheckpoint(today = new Date()) {
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const day = today.getDate()
  const lastDay = getDaysInMonth(year, month)

  if (day === lastDay) return { year, month, checkpoint: lastDay, isMonthEnd: true }
  const passed = MONTHLY_GOAL_CHECKPOINT_DAYS.filter((d) => d <= day)
  if (passed.length === 0) return null
  return { year, month, checkpoint: passed[passed.length - 1], isMonthEnd: false }
}

/**
 * 점검 알림 독려 문구
 * @param {number} overallRate - 0~100
 * @param {boolean} isMonthEnd
 * @returns {string}
 */
export function getEncouragementMessage(overallRate, isMonthEnd) {
  if (isMonthEnd) {
    if (overallRate >= 80) return '이번 달 정말 잘 해냈어요! 회고로 잘된 점을 남겨두세요.'
    if (overallRate >= 50) return '절반 넘게 해냈어요. 회고에서 다음 달에 이어갈 것을 골라봐요.'
    return '이번 달은 쉽지 않았죠. 회고로 원인을 짚고 다음 달은 더 작게 시작해봐요.'
  }
  if (overallRate >= 80) return '아주 좋은 페이스예요. 지금처럼만 이어가요!'
  if (overallRate >= 50) return '잘 하고 있어요. 남은 기간 조금만 더 힘내봐요!'
  return '아직 늦지 않았어요. 오늘 하나만 체크해도 다시 시작이에요.'
}
