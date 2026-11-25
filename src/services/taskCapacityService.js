import {
  TODAY_CAPACITY_CACHE_STORAGE_KEY,
  TODAY_CAPACITY_LOOKBACK_DAYS,
  TODAY_CAPACITY_MIN_ACTIVE_DAYS,
} from '../constants/backlogHealthCheck.js'
import { getSlotDayDate, getTimeSlotTimes } from '../constants/timeSlots.js'
import { getCompletedTasksSince } from './taskService.js'
import { getCurrentUserIdSync } from '../utils/authHelper.js'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * @typedef {Object} DailyCapacity
 * @property {number} avgPerActiveDay - 할일을 하나라도 끝낸 날의 하루 평균 완료 수
 * @property {number} activeDays - 할일을 끝낸 날 수
 */

/**
 * @param {Date} date
 * @returns {string} YYYY-MM-DD (로컬)
 */
function toDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 완료 기록 → 하루 처리량 (순수 함수)
 * 백로그 점검의 "일한 날 하루 평균"과 같은 기준 (새벽 완료는 전날로 셈)
 * @param {Array<{ completedAt: number }>} completed
 * @param {{ morning: number, afternoon: number, evening: number }} [times]
 * @returns {DailyCapacity}
 */
export function computeDailyCapacity(completed, times = getTimeSlotTimes()) {
  /** @type {Map<string, number>} */
  const countsByDay = new Map()
  completed.forEach((task) => {
    const completedAt = Number(task.completedAt)
    if (!Number.isFinite(completedAt) || completedAt <= 0) return
    const key = toDateString(getSlotDayDate(completedAt, times))
    countsByDay.set(key, (countsByDay.get(key) || 0) + 1)
  })
  const activeDays = countsByDay.size
  const total = [...countsByDay.values()].reduce((sum, count) => sum + count, 0)
  return {
    avgPerActiveDay: activeDays ? Math.round((total / activeDays) * 10) / 10 : 0,
    activeDays,
  }
}

/**
 * 과부하로 볼 남은 할일 개수 기준 (평소 처리량 + 여유분)
 * 예: 평소 5개 → 7개 넘으면 경고, 평소 10개 → 13개 넘으면 경고
 * @param {DailyCapacity | null} capacity
 * @returns {number | null} 기준이 없으면 null (기록 부족)
 */
export function getOverloadThreshold(capacity) {
  if (!capacity || capacity.activeDays < TODAY_CAPACITY_MIN_ACTIVE_DAYS) return null
  const base = Math.max(1, Math.round(capacity.avgPerActiveDay))
  return base + Math.max(2, Math.round(base * 0.3))
}

/**
 * 오늘 기준 하루 처리량 (같은 날·같은 사용자면 캐시 사용)
 * @returns {Promise<DailyCapacity | null>}
 */
export async function getDailyCapacity() {
  const userId = getCurrentUserIdSync()
  if (!userId) return null

  const today = toDateString(new Date())
  try {
    const cached = JSON.parse(localStorage.getItem(TODAY_CAPACITY_CACHE_STORAGE_KEY) || 'null')
    if (cached?.date === today && cached.userId === userId) {
      return { avgPerActiveDay: cached.avgPerActiveDay, activeDays: cached.activeDays }
    }
  } catch {
    // 캐시가 깨졌으면 다시 계산
  }

  // 오늘 완료분은 빼고 어제까지의 기록으로 계산 (하루 중에 기준이 흔들리지 않게)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const completed = await getCompletedTasksSince(todayStart.getTime() - TODAY_CAPACITY_LOOKBACK_DAYS * DAY_MS)
  const capacity = computeDailyCapacity(completed.filter((task) => Number(task.completedAt) < todayStart.getTime()))

  try {
    localStorage.setItem(
      TODAY_CAPACITY_CACHE_STORAGE_KEY,
      JSON.stringify({ date: today, userId, ...capacity }),
    )
  } catch {
    // 캐시 저장 실패는 무시
  }
  return capacity
}
