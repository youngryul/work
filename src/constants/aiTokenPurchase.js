/** 무통장 입금 계좌 */
export const AI_TOKEN_BANK_NAME = '카카오뱅크'
export const AI_TOKEN_BANK_ACCOUNT = '3333089356108'

/** 토큰 1개 기준 권장 단가 (원) */
export const AI_TOKEN_UNIT_PRICE_KRW = 500

/**
 * 권장 충전 패키지
 * @type {Array<{ tokens: number, priceKrw: number, description: string }>}
 */
export const AI_TOKEN_RECOMMENDED_PACKAGES = [
  {
    tokens: 10,
    priceKrw: 5000,
    description: '이미지 약 3회 (생성 비용 3토큰 기준)',
  },
  {
    tokens: 30,
    priceKrw: 12000,
    description: '이미지 약 10회',
  },
  {
    tokens: 50,
    priceKrw: 18000,
    description: '이미지 약 16회',
  },
]

/**
 * 토큰 수 → 권장 입금액 (원)
 * @param {number} tokens
 * @returns {number}
 */
export function getRecommendedPriceKrw(tokens) {
  const qty = Math.max(1, Math.floor(Number(tokens) || 0))
  const matched = AI_TOKEN_RECOMMENDED_PACKAGES.find((pkg) => pkg.tokens === qty)
  if (matched) return matched.priceKrw
  return qty * AI_TOKEN_UNIT_PRICE_KRW
}

/**
 * @param {number} amount
 * @returns {string}
 */
export function formatKrw(amount) {
  return `${Number(amount).toLocaleString('ko-KR')}원`
}
