/**
 * 오늘 할 일 시간대 (오전 / 오후 / 퇴근 후)
 * 시작 시각은 사용자가 설정에서 바꿀 수 있음 (getTimeSlotTimes)
 */
export const TIME_SLOTS = [
  { key: 'morning', label: '오전', emoji: '🌅' },
  { key: 'afternoon', label: '오후', emoji: '☀️' },
  { key: 'evening', label: '퇴근 후', emoji: '🌙' },
]

/** 시간대를 지정하지 않은 할 일 섹션 키 */
export const UNASSIGNED_SLOT_KEY = 'unassigned'

export const UNASSIGNED_SLOT = { key: UNASSIGNED_SLOT_KEY, label: '언제든', emoji: '🕒' }

/** 시간대별 보기 토글 저장 키 */
export const TIME_SLOT_VIEW_STORAGE_KEY = 'todayTimeSlotView'

/** 집중 모드(현재 시간대만 보기) 저장 키 */
export const TIME_SLOT_FOCUS_STORAGE_KEY = 'todayTimeSlotFocus'

/** 못 끝낸 할 일 자동 이월 저장 키 */
export const TIME_SLOT_AUTO_CARRY_STORAGE_KEY = 'todayTimeSlotAutoCarry'

/** 지난 시간대 정리 배너를 닫은 날짜·시간대 저장 키 */
export const TIME_SLOT_CLEANUP_DISMISS_STORAGE_KEY = 'todayTimeSlotCleanupDismissed'

/**
 * 다음 시간대로 넘긴 할 일 기록 저장 키
 * 값: { date: 'YYYY-MM-DD', carried: { [원래 시간대 키]: string[] } }
 * 원래 시간대의 진행 표시(완료/전체)에서 전체 개수를 유지하는 데 사용
 */
export const TIME_SLOT_CARRIED_STORAGE_KEY = 'todayTimeSlotCarried'

/** 사용자 지정 시간대 시작 시각 저장 키 (값: 하루 중 분 단위) */
export const TIME_SLOT_TIMES_STORAGE_KEY = 'todayTimeSlotTimes'

/** 이전 버전(시 단위) 저장 키 — 있으면 분 단위로 옮겨 읽음 */
const LEGACY_TIME_SLOT_HOURS_STORAGE_KEY = 'todayTimeSlotHours'

/** 시간대 설정이 바뀌면 발생하는 window 이벤트 */
export const TIME_SLOT_TIMES_CHANGED_EVENT = 'timeSlotTimesChanged'

const MINUTES_PER_DAY = 24 * 60

/**
 * 기본 시작 시각 (하루 중 분: 0 = 00:00)
 * 오전 시작 전(새벽)은 전날 '퇴근 후'로 취급
 */
export const DEFAULT_TIME_SLOT_MINUTES = { morning: 0, afternoon: 12 * 60, evening: 18 * 60 }

const SLOT_KEYS = TIME_SLOTS.map((slot) => slot.key)

/**
 * "HH:MM" 텍스트 → 하루 중 분 ("6:00", "06:00", "0600" 허용)
 * @param {string} text
 * @returns {number | null} 잘못된 형식이면 null
 */
export function parseTimeText(text) {
  const match = String(text || '').trim().match(/^(\d{1,2}):?(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * 하루 중 분 → "HH:MM"
 * @param {number} totalMinutes
 * @returns {string}
 */
export function formatMinutesAsTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * 시작 시각 설정이 유효한지 (0~1439분 정수, 오전 < 오후 < 퇴근 후)
 * @param {{ morning: number, afternoon: number, evening: number }} times
 * @returns {boolean}
 */
export function isValidTimeSlotTimes(times) {
  if (!times) return false
  const values = SLOT_KEYS.map((key) => times[key])
  if (!values.every((m) => Number.isInteger(m) && m >= 0 && m < MINUTES_PER_DAY)) return false
  return values[0] < values[1] && values[1] < values[2]
}

/**
 * 사용자 지정 시작 시각 (없거나 잘못되면 기본값)
 * @returns {{ morning: number, afternoon: number, evening: number }}
 */
export function getTimeSlotTimes() {
  try {
    const raw = localStorage.getItem(TIME_SLOT_TIMES_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (isValidTimeSlotTimes(parsed)) return parsed
    }
    // 이전 버전(시 단위) 설정이 있으면 분 단위로 변환
    const legacyRaw = localStorage.getItem(LEGACY_TIME_SLOT_HOURS_STORAGE_KEY)
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw)
      const converted = Object.fromEntries(SLOT_KEYS.map((key) => [key, Number(legacy?.[key]) * 60]))
      if (isValidTimeSlotTimes(converted)) return converted
    }
  } catch {
    // 기본값 사용
  }
  return { ...DEFAULT_TIME_SLOT_MINUTES }
}

/**
 * 시작 시각 저장 후 변경 이벤트 발생
 * @param {{ morning: number, afternoon: number, evening: number }} times
 */
export function saveTimeSlotTimes(times) {
  if (!isValidTimeSlotTimes(times)) {
    throw new Error('오전 < 오후 < 퇴근 후 순서로 시작 시각을 정해주세요.')
  }
  localStorage.setItem(TIME_SLOT_TIMES_STORAGE_KEY, JSON.stringify(times))
  localStorage.removeItem(LEGACY_TIME_SLOT_HOURS_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(TIME_SLOT_TIMES_CHANGED_EVENT))
}

/**
 * 시간대 범위 표기 (예: "06:00 ~ 12:30")
 * @param {string} key
 * @param {{ morning: number, afternoon: number, evening: number }} [times]
 * @returns {string}
 */
export function formatTimeSlotRange(key, times = getTimeSlotTimes()) {
  const index = SLOT_KEYS.indexOf(key)
  if (index < 0) return ''
  const start = formatMinutesAsTime(times[key])
  const endMinutes = times[SLOT_KEYS[(index + 1) % SLOT_KEYS.length]]
  // 퇴근 후가 자정을 넘기면 "다음 날"로 표시 (오전이 00:00이면 자정까지)
  if (index === SLOT_KEYS.length - 1) {
    return endMinutes === 0
      ? `${start} ~ 자정`
      : `${start} ~ 다음 날 ${formatMinutesAsTime(endMinutes)}`
  }
  return `${start} ~ ${formatMinutesAsTime(endMinutes)}`
}

/**
 * 시각 → 하루 중 분
 * @param {Date | number} dateOrTimestamp
 */
function getMinuteOfDay(dateOrTimestamp) {
  const date = new Date(dateOrTimestamp)
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * 유효한 시간대 키인지 확인
 * @param {string | null | undefined} key
 * @returns {boolean}
 */
export function isValidTimeSlot(key) {
  return SLOT_KEYS.includes(key)
}

/**
 * 시간대 키 → 시간대 정보 (미지정이면 UNASSIGNED_SLOT)
 * @param {string | null | undefined} key
 */
export function getTimeSlotInfo(key) {
  return TIME_SLOTS.find((slot) => slot.key === key) || UNASSIGNED_SLOT
}

/**
 * 오전 시작 전 새벽인지 (전날 '퇴근 후'의 연장)
 * @param {Date | number} [dateOrTimestamp]
 * @param {{ morning: number }} [times]
 */
export function isBeforeMorning(dateOrTimestamp = new Date(), times = getTimeSlotTimes()) {
  return getMinuteOfDay(dateOrTimestamp) < times.morning
}

/**
 * 시각 → 시간대 키
 * @param {Date | number} [dateOrTimestamp]
 * @param {{ morning: number, afternoon: number, evening: number }} [times]
 * @returns {string}
 */
export function getTimeSlotForDate(dateOrTimestamp = new Date(), times = getTimeSlotTimes()) {
  const minute = getMinuteOfDay(dateOrTimestamp)
  if (minute >= times.evening || minute < times.morning) return 'evening'
  if (minute >= times.afternoon) return 'afternoon'
  return 'morning'
}

/**
 * 현재 시간대보다 앞선(이미 지나간) 시간대 키 목록
 * 오전 시작 전 새벽에는 오늘 시간대가 아직 시작되지 않았으므로 빈 목록
 * @param {string} currentSlotKey
 * @param {Date | number} [dateOrTimestamp]
 * @returns {string[]}
 */
export function getPastTimeSlots(currentSlotKey, dateOrTimestamp = new Date()) {
  if (isBeforeMorning(dateOrTimestamp)) return []
  const index = SLOT_KEYS.indexOf(currentSlotKey)
  return index <= 0 ? [] : SLOT_KEYS.slice(0, index)
}
