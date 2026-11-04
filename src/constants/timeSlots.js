/**
 * 오늘 할 일 시간대 (오전 / 오후 / 퇴근 후)
 * startHour: 해당 시간대가 시작되는 시각 (0~23, 로컬 시간)
 */
export const TIME_SLOTS = [
  { key: 'morning', label: '오전', emoji: '🌅', startHour: 0 },
  { key: 'afternoon', label: '오후', emoji: '☀️', startHour: 12 },
  { key: 'evening', label: '퇴근 후', emoji: '🌙', startHour: 18 },
]

/** 시간대를 지정하지 않은 할 일 섹션 키 */
export const UNASSIGNED_SLOT_KEY = 'unassigned'

export const UNASSIGNED_SLOT = { key: UNASSIGNED_SLOT_KEY, label: '언제든', emoji: '🕒' }

/** 시간대별 보기 토글 저장 키 */
export const TIME_SLOT_VIEW_STORAGE_KEY = 'todayTimeSlotView'

/** 집중 모드(현재 시간대만 보기) 저장 키 */
export const TIME_SLOT_FOCUS_STORAGE_KEY = 'todayTimeSlotFocus'

/** 지난 시간대 정리 배너를 닫은 날짜·시간대 저장 키 */
export const TIME_SLOT_CLEANUP_DISMISS_STORAGE_KEY = 'todayTimeSlotCleanupDismissed'

const SLOT_KEYS = TIME_SLOTS.map((slot) => slot.key)

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
 * 시각 → 시간대 키
 * @param {Date | number} [dateOrTimestamp]
 * @returns {string}
 */
export function getTimeSlotForDate(dateOrTimestamp = new Date()) {
  const hour = new Date(dateOrTimestamp).getHours()
  let current = TIME_SLOTS[0].key
  for (const slot of TIME_SLOTS) {
    if (hour >= slot.startHour) current = slot.key
  }
  return current
}

/**
 * 현재 시간대보다 앞선(이미 지나간) 시간대 키 목록
 * @param {string} currentSlotKey
 * @returns {string[]}
 */
export function getPastTimeSlots(currentSlotKey) {
  const index = SLOT_KEYS.indexOf(currentSlotKey)
  return index <= 0 ? [] : SLOT_KEYS.slice(0, index)
}
