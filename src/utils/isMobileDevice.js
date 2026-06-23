/**
 * 모바일(터치 기기) 여부 — 스토리 공유 vs 웹 카드 UI 분기용
 * @returns {boolean}
 */
export function isMobileDevice() {
  if (typeof window === 'undefined') return false

  const ua = navigator.userAgent || ''
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const isNarrowTouch =
    window.matchMedia('(max-width: 768px)').matches &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 0

  return isMobileUa || isNarrowTouch
}
