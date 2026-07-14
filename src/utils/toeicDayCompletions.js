/**
 * Day별 단어 공부 완료 횟수 (localStorage)
 */

const STORAGE_KEY = 'toeic-norangi-day-completions-v1'

/**
 * @returns {Record<string, number>}
 */
export function loadDayCompletions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * @param {Record<string, number>} map
 */
export function saveDayCompletions(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

/**
 * @param {Record<string, number>} map
 * @param {number} day
 * @returns {number}
 */
export function getCompletionCount(map, day) {
  return Math.max(0, Number(map[String(day)]) || 0)
}
