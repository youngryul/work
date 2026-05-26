/** AI 토큰 잔액 변경 시 UI 즉시 갱신용 */
export const AI_TOKEN_UPDATED_EVENT = 'aiTokensUpdated'

/**
 * @param {{ balance?: number, generationCost?: number }} [detail]
 */
export function notifyAiTokensUpdated(detail = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AI_TOKEN_UPDATED_EVENT, { detail }))
}
