/** 젤리 잔액 변경 시 UI 즉시 갱신용 */
export const JELLY_UPDATED_EVENT = 'jellyUpdated'

/**
 * @param {{ balance?: number, awarded?: number }} [detail]
 */
export function notifyJellyUpdated(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(JELLY_UPDATED_EVENT, { detail }))
}
