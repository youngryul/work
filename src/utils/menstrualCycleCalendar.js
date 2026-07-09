import {
  DEFAULT_MENSTRUAL_CYCLE_LENGTH,
  DEFAULT_MENSTRUAL_PERIOD_LENGTH,
  MENSTRUAL_MARKER_TYPE,
  MENSTRUAL_PREDICTION_MONTHS,
} from '../constants/menstrualCycle.js'

/**
 * @param {Date} date
 * @returns {string}
 */
export function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * @param {string} dateKey - YYYY-MM-DD
 * @param {number} days
 * @returns {string}
 */
export function addDaysToDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

/**
 * @param {string} startDate
 * @param {string} endDate
 * @returns {string[]}
 */
export function enumerateDateKeys(startDate, endDate) {
  const dates = []
  const current = new Date(`${startDate}T00:00:00`)
  const last = new Date(`${endDate}T00:00:00`)
  while (current <= last) {
    dates.push(toDateKey(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

/**
 * @param {number} year
 * @param {number} month - 1~12
 * @param {number} [monthOffset]
 * @returns {{ rangeStart: string, rangeEnd: string }}
 */
export function getMonthDateRange(year, month, monthOffset = 0) {
  const date = new Date(year, month - 1 + monthOffset, 1)
  const rangeStart = toDateKey(new Date(date.getFullYear(), date.getMonth(), 1))
  const rangeEnd = toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0))
  return { rangeStart, rangeEnd }
}

/**
 * @param {Array<{ startDate: string, endDate: string, id?: string }>} periodRecords
 * @param {{ cycleLength?: number, periodLength?: number } | null} settings
 * @param {string} rangeStart
 * @param {string} rangeEnd
 * @returns {Map<string, { type: string, recordId?: string }>}
 */
export function buildMenstrualDateMarkers(periodRecords, settings, rangeStart, rangeEnd) {
  const markers = new Map()
  const cycleLength = settings?.cycleLength ?? DEFAULT_MENSTRUAL_CYCLE_LENGTH
  const periodLength = settings?.periodLength ?? DEFAULT_MENSTRUAL_PERIOD_LENGTH

  periodRecords.forEach((record) => {
    enumerateDateKeys(record.startDate, record.endDate).forEach((dateKey) => {
      if (dateKey >= rangeStart && dateKey <= rangeEnd) {
        markers.set(dateKey, {
          type: MENSTRUAL_MARKER_TYPE.RECORDED,
          recordId: record.id,
        })
      }
    })
  })

  if (periodRecords.length === 0) {
    return markers
  }

  const sortedStarts = [...periodRecords]
    .map((record) => record.startDate)
    .sort((a, b) => b.localeCompare(a))

  const latestStart = sortedStarts[0]
  const predictionEnd = getMonthDateRange(
    Number(rangeEnd.slice(0, 4)),
    Number(rangeEnd.slice(5, 7)),
    MENSTRUAL_PREDICTION_MONTHS,
  ).rangeEnd

  let nextStart = addDaysToDateKey(latestStart, cycleLength)
  while (nextStart <= predictionEnd) {
    const nextEnd = addDaysToDateKey(nextStart, periodLength - 1)
    enumerateDateKeys(nextStart, nextEnd).forEach((dateKey) => {
      if (dateKey >= rangeStart && dateKey <= rangeEnd && !markers.has(dateKey)) {
        markers.set(dateKey, { type: MENSTRUAL_MARKER_TYPE.PREDICTED })
      }
    })
    nextStart = addDaysToDateKey(nextStart, cycleLength)
  }

  return markers
}

/**
 * @param {Array<{ startDate: string, endDate: string, id: string }>} periodRecords
 * @param {string} dateKey
 * @returns {{ record: object, isStart: boolean } | null}
 */
export function findPeriodRecordForDate(periodRecords, dateKey) {
  const record = periodRecords.find(
    (item) => dateKey >= item.startDate && dateKey <= item.endDate,
  )
  if (!record) return null
  return {
    record,
    isStart: record.startDate === dateKey,
  }
}
