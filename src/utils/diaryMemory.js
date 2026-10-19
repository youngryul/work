/**
 * 과거 일기 상기 기능 (랜덤 일기 · 1년 전 오늘) 도우미
 * 표시 이력은 기기(localStorage)에만 저장한다.
 */

const RECENT_RANDOM_KEY = 'diaryRandomRecentDates'
const MEMORY_DISMISSED_KEY = 'diaryMemoryDismissedDate'
/** 최근에 보여준 랜덤 일기는 이 개수만큼 다시 뽑지 않음 */
const RECENT_RANDOM_LIMIT = 10

/**
 * @param {Date} date
 * @returns {string} YYYY-MM-DD (로컬)
 */
export function toLocalDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 1년 전 같은 날짜 (2월 29일이면 2월 28일)
 * @param {Date} [today]
 * @returns {string} YYYY-MM-DD
 */
export function getOneYearAgoDateString(today = new Date()) {
  const year = today.getFullYear() - 1
  const month = today.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return toLocalDateString(new Date(year, month, Math.min(today.getDate(), lastDay)))
}

function readRecentDates() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_RANDOM_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * 과거 일기 날짜 중 하나를 랜덤으로 고른다 (최근에 본 날짜와 지금 보고 있는 날짜는 되도록 제외)
 * @param {string[]} dates 과거 일기 날짜 목록
 * @param {string | null} [currentDate] 지금 보고 있는 날짜
 * @returns {string | null}
 */
export function pickRandomDiaryDate(dates, currentDate = null) {
  if (!dates || dates.length === 0) return null

  const recent = readRecentDates()
  // 일기가 적으면 최근 제외 개수를 줄여 후보가 남도록 함
  const excludeCount = Math.min(RECENT_RANDOM_LIMIT, Math.floor(dates.length / 2))
  const excluded = new Set(recent.slice(0, excludeCount))
  if (currentDate) excluded.add(currentDate)

  let candidates = dates.filter((date) => !excluded.has(date))
  if (candidates.length === 0) candidates = dates.filter((date) => date !== currentDate)
  if (candidates.length === 0) candidates = dates

  const picked = candidates[Math.floor(Math.random() * candidates.length)]
  try {
    const next = [picked, ...recent.filter((date) => date !== picked)].slice(0, RECENT_RANDOM_LIMIT)
    localStorage.setItem(RECENT_RANDOM_KEY, JSON.stringify(next))
  } catch {
    // 저장 실패해도 뽑기는 동작
  }
  return picked
}

/** 오늘 '1년 전 오늘' 카드를 닫았는지 */
export function isDiaryMemoryDismissedToday() {
  try {
    return localStorage.getItem(MEMORY_DISMISSED_KEY) === toLocalDateString(new Date())
  } catch {
    return false
  }
}

/** 오늘 하루 '1년 전 오늘' 카드 숨기기 */
export function dismissDiaryMemoryToday() {
  try {
    localStorage.setItem(MEMORY_DISMISSED_KEY, toLocalDateString(new Date()))
  } catch {
    // ignore
  }
}

/**
 * 일기 달력에서 특정 날짜 일기를 연다 (App.jsx가 이벤트를 받아 화면 전환)
 * @param {string} date YYYY-MM-DD
 */
export function openDiaryByDate(date) {
  window.dispatchEvent(new CustomEvent('openDiaryDate', { detail: { date } }))
}
