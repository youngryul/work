import {
  KOREAN_HOLIDAY_SUBSTITUTE_NAMES,
  KOREAN_HOLIDAY_TAG,
  KOREAN_TEMPORARY_HOLIDAYS,
  LUNAR_HOLIDAY_SOLAR_DATES,
} from '../constants/koreanHolidays.js'

/**
 * @param {Date} date
 * @returns {string} YYYY-MM-DD
 */
function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * @param {number} year
 * @param {number} month - 1~12
 * @param {number} day
 * @returns {string}
 */
function ymd(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * @param {string} dateKey
 * @param {number} days
 * @returns {string}
 */
function addDaysToDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

/**
 * @param {string} dateKey
 * @returns {number} 0=일 … 6=토
 */
function getWeekday(dateKey) {
  return new Date(`${dateKey}T00:00:00`).getDay()
}

/**
 * @param {string} dateKey
 * @returns {boolean}
 */
function isWeekend(dateKey) {
  const weekday = getWeekday(dateKey)
  return weekday === 0 || weekday === 6
}

/**
 * 토요일·일요일·기존 공휴일을 건너뛴 다음 평일
 * @param {string} afterDateKey
 * @param {Set<string>} occupied
 * @returns {string}
 */
function nextOpenWeekday(afterDateKey, occupied) {
  let dateKey = addDaysToDateKey(afterDateKey, 1)
  while (isWeekend(dateKey) || occupied.has(dateKey)) {
    dateKey = addDaysToDateKey(dateKey, 1)
  }
  return dateKey
}

/**
 * @param {Array<{ date: string, name: string }>} holidays
 * @param {string} dateKey
 * @param {string} name
 * @param {string} group
 */
function pushHoliday(holidays, dateKey, name, group) {
  holidays.push({ date: dateKey, name, group })
}

/**
 * 해당 연도의 음력 명절 양력일
 * @param {'seollal' | 'chuseok' | 'buddha'} kind
 * @param {number} year
 * @returns {string | null}
 */
function getLunarSolarDate(kind, year) {
  const monthDay = LUNAR_HOLIDAY_SOLAR_DATES[kind]?.[year]
  return monthDay ? `${year}-${monthDay}` : null
}

/**
 * 한 해의 법정 공휴일 + 대체공휴일
 * @param {number} year
 * @returns {Array<{ date: string, name: string, group: string }>}
 */
function buildHolidaysForYear(year) {
  const holidays = []

  pushHoliday(holidays, ymd(year, 1, 1), '신정', 'none')
  pushHoliday(holidays, ymd(year, 3, 1), '삼일절', 'single')
  pushHoliday(holidays, ymd(year, 5, 5), '어린이날', 'single')
  pushHoliday(holidays, ymd(year, 6, 6), '현충일', 'none')
  pushHoliday(holidays, ymd(year, 8, 15), '광복절', 'single')
  pushHoliday(holidays, ymd(year, 10, 3), '개천절', 'single')
  pushHoliday(holidays, ymd(year, 10, 9), '한글날', 'single')
  pushHoliday(holidays, ymd(year, 12, 25), '크리스마스', 'single')

  const seollal = getLunarSolarDate('seollal', year)
  if (seollal) {
    pushHoliday(holidays, addDaysToDateKey(seollal, -1), '설날 연휴', 'seollal')
    pushHoliday(holidays, seollal, '설날', 'seollal')
    pushHoliday(holidays, addDaysToDateKey(seollal, 1), '설날 연휴', 'seollal')
  }

  const chuseok = getLunarSolarDate('chuseok', year)
  if (chuseok) {
    pushHoliday(holidays, addDaysToDateKey(chuseok, -1), '추석 연휴', 'chuseok')
    pushHoliday(holidays, chuseok, '추석', 'chuseok')
    pushHoliday(holidays, addDaysToDateKey(chuseok, 1), '추석 연휴', 'chuseok')
  }

  const buddha = getLunarSolarDate('buddha', year)
  if (buddha) {
    pushHoliday(holidays, buddha, '부처님오신날', 'single')
  }

  Object.entries(KOREAN_TEMPORARY_HOLIDAYS).forEach(([dateKey, name]) => {
    if (dateKey.startsWith(`${year}-`)) {
      pushHoliday(holidays, dateKey, name, 'none')
    }
  })

  const occupied = new Set(holidays.map((item) => item.date))
  const namesByDate = new Map()
  holidays.forEach((item) => {
    const names = namesByDate.get(item.date) || []
    names.push(item.name)
    namesByDate.set(item.date, names)
  })

  const addSubstitute = (afterDateKey, title) => {
    const dateKey = nextOpenWeekday(afterDateKey, occupied)
    occupied.add(dateKey)
    holidays.push({ date: dateKey, name: title, group: 'substitute' })
  }

  ;['seollal', 'chuseok'].forEach((group) => {
    const groupDays = holidays
      .filter((item) => item.group === group)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (groupDays.length === 0) return

    const overlapsSunday = groupDays.some((item) => getWeekday(item.date) === 0)
    const overlapsOtherHoliday = groupDays.some((item) => {
      const names = namesByDate.get(item.date) || []
      return names.some((name) => !name.startsWith(group === 'seollal' ? '설날' : '추석'))
    })
    if (!overlapsSunday && !overlapsOtherHoliday) return

    const lastDate = groupDays[groupDays.length - 1].date
    const label = group === 'seollal' ? '설날 대체공휴일' : '추석 대체공휴일'
    addSubstitute(lastDate, label)
  })

  const seollalChuseokDates = new Set(
    holidays.filter((item) => item.group === 'seollal' || item.group === 'chuseok').map((item) => item.date),
  )

  const handledSingleDates = new Set()
  holidays.forEach((item) => {
    if (item.group !== 'single') return
    if (!KOREAN_HOLIDAY_SUBSTITUTE_NAMES.has(item.name)) return
    if (seollalChuseokDates.has(item.date)) return
    if (handledSingleDates.has(item.date)) return

    const names = namesByDate.get(item.date) || []
    const overlapsOther = names.length > 1
    if (!isWeekend(item.date) && !overlapsOther) return

    handledSingleDates.add(item.date)
    const title =
      names.filter((name) => KOREAN_HOLIDAY_SUBSTITUTE_NAMES.has(name)).length > 1
        ? '대체공휴일'
        : `${item.name} 대체공휴일`
    addSubstitute(item.date, title)
  })

  return holidays.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.name.localeCompare(b.name, 'ko')
  })
}

/**
 * 기간 안의 한국 공휴일 목록
 * @param {string} rangeStart - YYYY-MM-DD
 * @param {string} rangeEnd - YYYY-MM-DD
 * @returns {Array<{ date: string, name: string, group: string }>}
 */
export function getKoreanHolidaysInRange(rangeStart, rangeEnd) {
  if (!rangeStart || !rangeEnd || rangeEnd < rangeStart) return []

  const startYear = Number(rangeStart.slice(0, 4))
  const endYear = Number(rangeEnd.slice(0, 4))
  const merged = []
  const seen = new Set()

  for (let year = startYear - 1; year <= endYear + 1; year += 1) {
    buildHolidaysForYear(year).forEach((item) => {
      if (item.date < rangeStart || item.date > rangeEnd) return
      const key = `${item.date}:${item.name}`
      if (seen.has(key)) return
      seen.add(key)
      merged.push(item)
    })
  }

  return merged.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.name.localeCompare(b.name, 'ko')
  })
}

/**
 * 해당 월의 한국 공휴일
 * @param {number} year
 * @param {number} month - 1~12
 * @returns {Array<{ date: string, name: string, group: string }>}
 */
export function getKoreanHolidaysForMonth(year, month) {
  const start = ymd(year, month, 1)
  const end = toDateKey(new Date(year, month, 0))
  return getKoreanHolidaysInRange(start, end)
}

/**
 * 달력 표시용 공휴일 일정 객체
 * @param {{ date: string, name: string }} holiday
 * @returns {Object}
 */
export function toHolidaySchedule(holiday) {
  return {
    id: `holiday:${holiday.date}:${holiday.name}`,
    scheduleDate: holiday.date,
    endDate: holiday.date,
    title: holiday.name,
    tag: KOREAN_HOLIDAY_TAG.name,
    isHoliday: true,
    repeatType: 'none',
  }
}
