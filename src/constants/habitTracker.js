/** 습관 트래커 UI 에셋·레이아웃 상수 */

export const HABIT_TRACKER_BG_IMAGE = '/images/트래커.png'
export const HABIT_TRACKER_POSILY_IMAGE = '/images/포실이.png'

export const HABIT_TRACKER_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 목록 그리드 — 한 행에 트래커 2개 */
export const HABIT_TRACKER_LIST_COLUMNS = 2

/** 밭 안 미니 달력 — 7열 (주간 달력) */
export const HABIT_TRACKER_CALENDAR_COLUMNS = 7

/**
 * 습관 제목 영역 — 이미지 점선 박스 (1254×1254 기준 %)
 * top은 박스 상단, flex로 세로 가운데 정렬
 */
export const HABIT_TRACKER_TITLE_AREA = {
  top: '12%',
  left: '50%',
  width: '44%',
  height: '5.5%',
}

/**
 * 이미지 위 갈색 밭 영역 (1254×1254 기준 %)
 */
export const HABIT_TRACKER_SOIL_AREA = {
  top: '30%',
  left: '11%',
  width: '78%',
  height: '57%',
}

/**
 * @param {number} year
 * @param {number} month
 * @returns {number}
 */
export function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

/**
 * 해당 월 달력 셀 (0 = 빈 칸, 1~31 = 일)
 * @param {number} year
 * @param {number} month
 * @returns {number[]}
 */
export function buildCalendarCells(year, month) {
  const totalDays = getDaysInMonth(year, month)
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const cells = []

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(0)
  }
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(day)
  }
  while (cells.length % HABIT_TRACKER_CALENDAR_COLUMNS !== 0) {
    cells.push(0)
  }

  return cells
}

/**
 * @param {number} day
 * @param {number} year
 * @param {number} month
 * @returns {boolean}
 */
export function isFutureTrackerDay(day, year, month) {
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const currentDay = today.getDate()

  if (year > currentYear) return true
  if (year < currentYear) return false
  if (month > currentMonth) return true
  if (month < currentMonth) return false
  return day > currentDay
}

/**
 * @param {number} day
 * @param {number} year
 * @param {number} month
 * @returns {boolean}
 */
export function isTodayTrackerDay(day, year, month) {
  const today = new Date()
  return (
    today.getFullYear() === year &&
    today.getMonth() + 1 === month &&
    today.getDate() === day
  )
}

/**
 * @param {number} columnIndex - 0(일) ~ 6(토)
 * @returns {boolean}
 */
export function isSundayColumn(columnIndex) {
  return columnIndex === 0
}

/**
 * @param {number} columnIndex
 * @returns {boolean}
 */
export function isSaturdayColumn(columnIndex) {
  return columnIndex === 6
}
