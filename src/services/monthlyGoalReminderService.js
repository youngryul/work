/**
 * 월별 목표 10일 점검 알림 서비스
 * 10일 · 20일 · 말일에 목표 달성률과 습관 실천율을 보여준다.
 * 점검일마다 한 번만 표시하며, 점검일을 놓치면 다음 점검일 전까지 앱을 열 때 표시한다.
 */
import { getCurrentUserId } from '../utils/authHelper.js'
import { getMonthlyGoalHabitBoard } from './goalService.js'
import {
  getCurrentCheckpoint,
  getEncouragementMessage,
  summarizeMonthlyGoals,
} from '../utils/monthlyGoalProgress.js'

/**
 * @param {string} userId
 * @param {{ year: number, month: number, checkpoint: number }} checkpoint
 */
function storageKey(userId, { year, month, checkpoint }) {
  return `posily_monthly_goal_reminder_${userId}_${year}-${month}_${checkpoint}`
}

/**
 * 현재 점검일 알림을 이미 확인했는지
 * @param {string} [userId]
 * @returns {Promise<boolean>} 점검일이 아니거나 이미 확인했으면 true
 */
export async function hasMonthlyGoalReminderShown(userId = null) {
  const uid = userId || (await getCurrentUserId())
  const checkpoint = getCurrentCheckpoint()
  if (!uid || !checkpoint) return true
  try {
    return localStorage.getItem(storageKey(uid, checkpoint)) === '1'
  } catch {
    return false
  }
}

/**
 * 현재 점검일 알림 확인 처리
 * @param {string} [userId]
 */
export async function markMonthlyGoalReminderShown(userId = null) {
  const uid = userId || (await getCurrentUserId())
  const checkpoint = getCurrentCheckpoint()
  if (!uid || !checkpoint) return
  try {
    localStorage.setItem(storageKey(uid, checkpoint), '1')
  } catch {
    // ignore
  }
}

/**
 * 점검 알림용 데이터 (목표가 없으면 summary.totalCount = 0)
 * @returns {Promise<Object|null>} 점검일이 아니면 null
 */
export async function fetchMonthlyGoalReminderPayload() {
  const checkpoint = getCurrentCheckpoint()
  if (!checkpoint) return null

  const { goals } = await getMonthlyGoalHabitBoard(checkpoint.year, checkpoint.month)
  const summary = summarizeMonthlyGoals(goals, checkpoint.year, checkpoint.month)

  return {
    ...checkpoint,
    summary,
    message: getEncouragementMessage(summary.overallRate, checkpoint.isMonthEnd),
  }
}
