/** @typedef {'none' | 'weekly' | 'monthly' | 'yearly'} ScheduleRepeatType */
/** @typedef {'never' | 'count' | 'until'} ScheduleRepeatEndType */
/** @typedef {'day' | 'nth_weekday' | 'last_weekday' | 'last_day'} ScheduleMonthlyRule */

export const SCHEDULE_REPEAT_TYPES = [
  { id: /** @type {const} */ ('none'), label: '반복 없음' },
  { id: /** @type {const} */ ('weekly'), label: '매주' },
  { id: /** @type {const} */ ('monthly'), label: '매월' },
  { id: /** @type {const} */ ('yearly'), label: '매년' },
]

/** JS getDay(): 0=일 … 6=토 */
export const SCHEDULE_WEEKDAYS = [
  { id: 1, label: '월' },
  { id: 2, label: '화' },
  { id: 3, label: '수' },
  { id: 4, label: '목' },
  { id: 5, label: '금' },
  { id: 6, label: '토' },
  { id: 0, label: '일' },
]

export const SCHEDULE_MONTHLY_RULES = [
  { id: /** @type {const} */ ('day'), label: '매월 같은 날짜' },
  { id: /** @type {const} */ ('nth_weekday'), label: '매월 N번째 요일' },
  { id: /** @type {const} */ ('last_weekday'), label: '매월 마지막 요일' },
  { id: /** @type {const} */ ('last_day'), label: '매월 말일' },
]

export const SCHEDULE_NTH_OPTIONS = [
  { id: 1, label: '첫 번째' },
  { id: 2, label: '두 번째' },
  { id: 3, label: '세 번째' },
  { id: 4, label: '네 번째' },
]

export const SCHEDULE_REPEAT_END_TYPES = [
  { id: /** @type {const} */ ('never'), label: '종료일 없음' },
  { id: /** @type {const} */ ('count'), label: '반복 횟수' },
  { id: /** @type {const} */ ('until'), label: '종료일' },
]

export const DEFAULT_SCHEDULE_REPEAT_TYPE = /** @type {ScheduleRepeatType} */ ('none')

/**
 * @param {string | null | undefined} value
 * @returns {ScheduleRepeatType}
 */
export function normalizeScheduleRepeatType(value) {
  if (value === 'weekly' || value === 'monthly' || value === 'yearly') return value
  return DEFAULT_SCHEDULE_REPEAT_TYPE
}

/**
 * @param {string | null | undefined} value
 * @returns {ScheduleRepeatEndType}
 */
export function normalizeScheduleRepeatEndType(value) {
  if (value === 'count' || value === 'until' || value === 'never') return value
  return 'never'
}

/**
 * @param {string | null | undefined} value
 * @returns {ScheduleMonthlyRule}
 */
export function normalizeScheduleMonthlyRule(value) {
  if (
    value === 'day' ||
    value === 'nth_weekday' ||
    value === 'last_weekday' ||
    value === 'last_day'
  ) {
    return value
  }
  return 'day'
}

/**
 * @param {string | number[] | null | undefined} value
 * @returns {number[]}
 */
export function normalizeScheduleWeekdays(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(Number).filter((n) => n >= 0 && n <= 6))].sort(
      (a, b) => a - b,
    )
  }
  if (typeof value === 'string' && value.trim()) {
    return [
      ...new Set(
        value
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6),
      ),
    ].sort((a, b) => a - b)
  }
  return []
}

/**
 * @param {string} repeatType
 * @returns {string}
 */
export function getScheduleRepeatLabel(repeatType) {
  return (
    SCHEDULE_REPEAT_TYPES.find((item) => item.id === repeatType)?.label ?? '반복 없음'
  )
}

/**
 * @param {object} schedule
 * @returns {string}
 */
export function describeScheduleRepeat(schedule) {
  const type = normalizeScheduleRepeatType(schedule.repeatType)
  if (type === 'none') return '반복 없음'

  const interval = Math.max(1, Number(schedule.repeatInterval) || 1)
  const endType = normalizeScheduleRepeatEndType(schedule.repeatEndType)
  let endText = ''
  if (endType === 'until' && schedule.repeatUntil) {
    endText = ` · ${schedule.repeatUntil}까지`
  } else if (endType === 'count' && schedule.repeatCount) {
    endText = ` · ${schedule.repeatCount}회`
  }

  if (type === 'weekly') {
    const days = normalizeScheduleWeekdays(schedule.repeatWeekdays)
    const dayLabels = SCHEDULE_WEEKDAYS.filter((d) => days.includes(d.id))
      .map((d) => d.label)
      .join('')
    const every = interval === 1 ? '매주' : `${interval}주마다`
    return `${every}${dayLabels ? ` ${dayLabels}` : ''}${endText}`
  }

  if (type === 'monthly') {
    const every = interval === 1 ? '매월' : `${interval}개월마다`
    const rule = normalizeScheduleMonthlyRule(schedule.repeatMonthlyRule)
    let detail = ''
    if (rule === 'day') {
      detail = ` ${schedule.repeatMonthDay || 1}일`
    } else if (rule === 'last_day') {
      detail = ' 말일'
    } else if (rule === 'last_weekday') {
      const w = SCHEDULE_WEEKDAYS.find((d) => d.id === Number(schedule.repeatWeekday))
      detail = ` 마지막 ${w?.label || ''}요일`
    } else {
      const nth = SCHEDULE_NTH_OPTIONS.find((n) => n.id === Number(schedule.repeatNth))
      const w = SCHEDULE_WEEKDAYS.find((d) => d.id === Number(schedule.repeatWeekday))
      detail = ` ${nth?.label || ''} ${w?.label || ''}요일`
    }
    return `${every}${detail}${endText}`
  }

  const every = interval === 1 ? '매년' : `${interval}년마다`
  const start = schedule.seriesStartDate || schedule.scheduleDate
  if (start) {
    const d = parseLocalDate(start)
    return `${every} ${d.getMonth() + 1}월 ${d.getDate()}일${endText}`
  }
  return `${every}${endText}`
}

/**
 * @param {string} ymd YYYY-MM-DD
 * @returns {Date}
 */
function parseLocalDate(ymd) {
  return new Date(`${ymd}T00:00:00`)
}

/**
 * @param {Date} date
 * @returns {string}
 */
export function toScheduleDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * @param {string} ymd
 * @param {number} days
 * @returns {string}
 */
export function addScheduleDays(ymd, days) {
  const date = parseLocalDate(ymd)
  date.setDate(date.getDate() + days)
  return toScheduleDateString(date)
}

/**
 * @param {string} startDate
 * @param {string} endDate
 * @returns {number}
 */
export function getScheduleDurationOffsetDays(startDate, endDate) {
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate || startDate)
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000))
}

/**
 * @param {number} year
 * @param {number} month 0-11
 * @param {number} weekday 0-6
 * @param {number} nth 1-4 or -1 (last)
 * @returns {string | null}
 */
function nthWeekdayOfMonth(year, month, weekday, nth) {
  if (nth === -1) {
    const lastDay = new Date(year, month + 1, 0)
    const date = new Date(lastDay)
    while (date.getDay() !== weekday) {
      date.setDate(date.getDate() - 1)
    }
    return toScheduleDateString(date)
  }

  const first = new Date(year, month, 1)
  const date = new Date(first)
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() + 1)
  }
  date.setDate(date.getDate() + (nth - 1) * 7)
  if (date.getMonth() !== month) return null
  return toScheduleDateString(date)
}

/**
 * @param {string} seriesStart
 * @param {object} schedule
 * @param {string} hardLimit
 * @param {number} maxCount
 * @returns {string[]}
 */
function generateOccurrenceStarts(seriesStart, schedule, hardLimit, maxCount) {
  const type = normalizeScheduleRepeatType(schedule.repeatType)
  const interval = Math.max(1, Number(schedule.repeatInterval) || 1)
  /** @type {string[]} */
  const starts = []

  if (type === 'weekly') {
    let weekdays = normalizeScheduleWeekdays(schedule.repeatWeekdays)
    if (weekdays.length === 0) {
      weekdays = [parseLocalDate(seriesStart).getDay()]
    }

    // seriesStart가 속한 주의 일요일을 기준 주로 삼고 interval주마다 해당 요일 수집
    const origin = parseLocalDate(seriesStart)
    const originWeekStart = new Date(origin)
    originWeekStart.setDate(origin.getDate() - origin.getDay())

    let cursor = parseLocalDate(seriesStart)
    let guard = 0
    while (toScheduleDateString(cursor) <= hardLimit && guard < 2000) {
      const weekStart = new Date(cursor)
      weekStart.setDate(cursor.getDate() - cursor.getDay())
      const weeksFromOrigin = Math.floor(
        (weekStart.getTime() - originWeekStart.getTime()) / (7 * 86400000),
      )
      if (weeksFromOrigin >= 0 && weeksFromOrigin % interval === 0) {
        const dow = cursor.getDay()
        if (weekdays.includes(dow) && toScheduleDateString(cursor) >= seriesStart) {
          starts.push(toScheduleDateString(cursor))
          if (starts.length >= maxCount) break
        }
      }
      cursor.setDate(cursor.getDate() + 1)
      guard += 1
    }
    return starts
  }

  if (type === 'monthly') {
    const rule = normalizeScheduleMonthlyRule(schedule.repeatMonthlyRule)
    const start = parseLocalDate(seriesStart)
    let year = start.getFullYear()
    let month = start.getMonth()
    let monthIndex = 0
    let guard = 0

    while (guard < 600) {
      if (monthIndex % interval === 0) {
        let occ = null
        if (rule === 'day') {
          const day = Math.min(
            Math.max(1, Number(schedule.repeatMonthDay) || start.getDate()),
            new Date(year, month + 1, 0).getDate(),
          )
          occ = toScheduleDateString(new Date(year, month, day))
        } else if (rule === 'last_day') {
          occ = toScheduleDateString(new Date(year, month + 1, 0))
        } else if (rule === 'last_weekday') {
          const weekday = Number.isFinite(Number(schedule.repeatWeekday))
            ? Number(schedule.repeatWeekday)
            : start.getDay()
          occ = nthWeekdayOfMonth(year, month, weekday, -1)
        } else {
          const nth = Number(schedule.repeatNth) || 1
          const weekday = Number.isFinite(Number(schedule.repeatWeekday))
            ? Number(schedule.repeatWeekday)
            : start.getDay()
          occ = nthWeekdayOfMonth(year, month, weekday, nth)
        }

        if (occ && occ >= seriesStart && occ <= hardLimit) {
          starts.push(occ)
          if (starts.length >= maxCount) break
        }
        if (occ && occ > hardLimit) break
      }

      month += 1
      if (month > 11) {
        month = 0
        year += 1
      }
      monthIndex += 1
      guard += 1
    }
    return starts
  }

  if (type === 'yearly') {
    const start = parseLocalDate(seriesStart)
    const month = start.getMonth()
    const day = start.getDate()
    let year = start.getFullYear()
    let yearIndex = 0
    let guard = 0
    while (guard < 200) {
      if (yearIndex % interval === 0) {
        const lastDay = new Date(year, month + 1, 0).getDate()
        const occ = toScheduleDateString(new Date(year, month, Math.min(day, lastDay)))
        if (occ >= seriesStart && occ <= hardLimit) {
          starts.push(occ)
          if (starts.length >= maxCount) break
        }
        if (occ > hardLimit) break
      }
      year += 1
      yearIndex += 1
      guard += 1
    }
    return starts
  }

  return [seriesStart]
}

/**
 * 마스터 일정을 조회 기간에 맞춰 펼칩니다.
 * @param {object} schedule
 * @param {string} rangeStart YYYY-MM-DD
 * @param {string} rangeEnd YYYY-MM-DD
 * @returns {object[]}
 */
export function expandScheduleForRange(schedule, rangeStart, rangeEnd) {
  const repeatType = normalizeScheduleRepeatType(schedule.repeatType)
  const durationOffset = getScheduleDurationOffsetDays(
    schedule.scheduleDate,
    schedule.endDate || schedule.scheduleDate,
  )

  if (repeatType === 'none') {
    const end = schedule.endDate || schedule.scheduleDate
    if (end < rangeStart || schedule.scheduleDate > rangeEnd) return []
    return [
      {
        ...schedule,
        seriesId: schedule.id,
        seriesStartDate: schedule.scheduleDate,
        isOccurrence: false,
      },
    ]
  }

  const endType = normalizeScheduleRepeatEndType(schedule.repeatEndType)
  const maxCount =
    endType === 'count'
      ? Math.max(1, Number(schedule.repeatCount) || 1)
      : 500

  let hardLimit = rangeEnd
  if (endType === 'until' && schedule.repeatUntil) {
    hardLimit = schedule.repeatUntil < hardLimit ? schedule.repeatUntil : hardLimit
  } else if (endType === 'never') {
    // 조회 범위까지만
    hardLimit = rangeEnd
  }

  // count 종료는 시리즈 시작부터 전체 횟수를 세야 하므로 충분히 앞으로 생성 후 필터
  const generateUntil =
    endType === 'count'
      ? addScheduleDays(schedule.scheduleDate, 3650)
      : hardLimit

  const allStarts = generateOccurrenceStarts(
    schedule.scheduleDate,
    schedule,
    generateUntil,
    maxCount,
  )

  return allStarts
    .filter((occStart) => {
      const occEnd = addScheduleDays(occStart, durationOffset)
      return occEnd >= rangeStart && occStart <= rangeEnd && occStart <= hardLimit
    })
    .map((occStart) => ({
      ...schedule,
      id: `${schedule.id}__${occStart}`,
      seriesId: schedule.id,
      seriesStartDate: schedule.scheduleDate,
      scheduleDate: occStart,
      endDate: addScheduleDays(occStart, durationOffset),
      isOccurrence: true,
    }))
}

/**
 * @param {string} scheduleId
 * @returns {string}
 */
export function getScheduleSeriesId(scheduleId) {
  if (!scheduleId) return ''
  const sep = scheduleId.indexOf('__')
  return sep >= 0 ? scheduleId.slice(0, sep) : scheduleId
}

/**
 * 폼 기본값 (시작일 기준)
 * @param {string} startYmd
 */
export function buildDefaultRepeatFormState(startYmd) {
  const date = parseLocalDate(startYmd || toScheduleDateString(new Date()))
  const until = new Date(date)
  until.setMonth(until.getMonth() + 2)
  return {
    repeatType: 'none',
    repeatInterval: 1,
    repeatWeekdays: [date.getDay()],
    repeatMonthlyRule: 'day',
    repeatMonthDay: date.getDate(),
    repeatNth: Math.min(4, Math.ceil(date.getDate() / 7)),
    repeatWeekday: date.getDay(),
    repeatEndType: 'until',
    repeatCount: 10,
    repeatUntil: toScheduleDateString(until),
  }
}
