import { getCurrentUserId } from '../utils/authHelper.js'
import { getBacklogTasks } from './taskService.js'
import {
  formatBacklogStaleNotificationMessage,
  isBacklogStaleTwoWeeks,
} from '../utils/backlogStale.js'

function todayKey() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function storageKey(userId) {
  return `posily_backlog_stale_reminder_${userId}_${todayKey()}`
}

/**
 * 오늘 2주+ 백로그 알림을 이미 확인했는지
 * @param {string} [userId]
 * @returns {Promise<boolean>}
 */
export async function hasBacklogStaleReminderToday(userId = null) {
  const uid = userId || (await getCurrentUserId())
  if (!uid) return true
  try {
    return localStorage.getItem(storageKey(uid)) === '1'
  } catch {
    return false
  }
}

/**
 * 오늘 2주+ 백로그 알림 확인 처리
 * @param {string} [userId]
 */
export async function markBacklogStaleReminderShown(userId = null) {
  const uid = userId || (await getCurrentUserId())
  if (!uid) return
  try {
    localStorage.setItem(storageKey(uid), '1')
  } catch {
    // ignore
  }
}

/**
 * 2주 이상 지난 백로그 할일 알림용 데이터
 * @returns {Promise<{ tasks: Array, titles: string[], message: string }>}
 */
export async function fetchBacklogStaleReminderPayload() {
  const backlog = await getBacklogTasks()
  const tasks = (backlog || []).filter((task) => isBacklogStaleTwoWeeks(task))
  const titles = tasks.map((t) => t.title).filter(Boolean)
  return {
    tasks,
    titles,
    message: formatBacklogStaleNotificationMessage(titles),
  }
}
