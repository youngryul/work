/** 냉장고 구역 코드 */
export const FRIDGE_ZONES = {
  FRIDGE: 'fridge',
  FREEZER: 'freezer',
  PANTRY: 'pantry',
}

/** 구역 탭 목록 (표시 순서) */
export const FRIDGE_ZONE_TABS = [
  { id: FRIDGE_ZONES.FRIDGE, label: '냉장실' },
  { id: FRIDGE_ZONES.FREEZER, label: '냉동고' },
  { id: FRIDGE_ZONES.PANTRY, label: '실온' },
]

/** 상품 상태 코드 */
export const FRIDGE_STATUSES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DISCARDED: 'discarded',
}

/** 상태 필터 탭 */
export const FRIDGE_STATUS_TABS = [
  { id: FRIDGE_STATUSES.ACTIVE, label: '보관중' },
  { id: FRIDGE_STATUSES.COMPLETED, label: '완료' },
  { id: FRIDGE_STATUSES.DISCARDED, label: '폐기' },
]

/**
 * 구역 코드 → 한글 라벨
 * @param {string} zone
 * @returns {string}
 */
export function getFridgeZoneLabel(zone) {
  const tab = FRIDGE_ZONE_TABS.find((item) => item.id === zone)
  return tab?.label ?? zone
}

/**
 * 상태 코드 → 한글 라벨
 * @param {string} status
 * @returns {string}
 */
export function getFridgeStatusLabel(status) {
  const tab = FRIDGE_STATUS_TABS.find((item) => item.id === status)
  return tab?.label ?? status
}
