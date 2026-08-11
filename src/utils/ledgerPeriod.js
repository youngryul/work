/**
 * 가계부 기간 계산 유틸
 * 주 시작: 월요일
 */

import { LEDGER_PERIOD_UNITS } from '../constants/ledger.js'

/**
 * Date → YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
export function toDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * YYYY-MM-DD → 로컬 Date (00:00)
 * @param {string} dateStr
 * @returns {Date}
 */
export function parseDateString(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * @param {string} dateStr YYYY-MM-DD 또는 ISO datetime
 * @param {string} startDate
 * @param {string} endDate
 * @returns {boolean}
 */
export function isDateInRange(dateStr, startDate, endDate) {
  if (!dateStr) return false
  const day = String(dateStr).slice(0, 10)
  return day >= startDate && day <= endDate
}

/**
 * 해당 주의 월요일
 * @param {Date} date
 * @returns {Date}
 */
function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = result.getDay() // 0=일 … 6=토
  const diff = day === 0 ? -6 : 1 - day
  result.setDate(result.getDate() + diff)
  return result
}

/**
 * @param {Date} date
 * @returns {Date}
 */
function endOfWeek(date) {
  const start = startOfWeek(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return end
}

/**
 * @param {Date} date
 * @returns {Date}
 */
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * @param {Date} date
 * @returns {Date}
 */
function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

/**
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
function addDays(date, days) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() + days)
  return result
}

/**
 * 일/주/월 현재·이전 기간 범위
 * @param {'day'|'week'|'month'} periodUnit
 * @param {Date|string} [baseDate]
 * @returns {{
 *   current: { startDate: string, endDate: string },
 *   previous: { startDate: string, endDate: string },
 *   labels: { current: string, previous: string }
 * }}
 */
export function getPeriodRanges(periodUnit, baseDate = new Date()) {
  const base =
    typeof baseDate === 'string' ? parseDateString(baseDate) : new Date(baseDate)
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate())

  if (periodUnit === LEDGER_PERIOD_UNITS.DAY) {
    const currentStr = toDateString(today)
    const yesterday = addDays(today, -1)
    const previousStr = toDateString(yesterday)
    return {
      current: { startDate: currentStr, endDate: currentStr },
      previous: { startDate: previousStr, endDate: previousStr },
      labels: { current: '오늘', previous: '어제' },
    }
  }

  if (periodUnit === LEDGER_PERIOD_UNITS.WEEK) {
    const currentStart = startOfWeek(today)
    const currentEnd = endOfWeek(today)
    const previousEnd = addDays(currentStart, -1)
    const previousStart = startOfWeek(previousEnd)
    return {
      current: {
        startDate: toDateString(currentStart),
        endDate: toDateString(currentEnd),
      },
      previous: {
        startDate: toDateString(previousStart),
        endDate: toDateString(previousEnd),
      },
      labels: { current: '이번 주', previous: '지난 주' },
    }
  }

  // month
  const currentStart = startOfMonth(today)
  const currentEnd = endOfMonth(today)
  const previousMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const previousStart = startOfMonth(previousMonthDate)
  const previousEnd = endOfMonth(previousMonthDate)
  return {
    current: {
      startDate: toDateString(currentStart),
      endDate: toDateString(currentEnd),
    },
    previous: {
      startDate: toDateString(previousStart),
      endDate: toDateString(previousEnd),
    },
    labels: { current: '이번 달', previous: '지난 달' },
  }
}

/**
 * 표시용 날짜 라벨 (2026.08.10)
 * @param {string} dateStr
 * @returns {string}
 */
export function formatLedgerDateLabel(dateStr) {
  if (!dateStr) return ''
  const day = String(dateStr).slice(0, 10)
  const [y, m, d] = day.split('-')
  return `${y}.${m}.${d}`
}
