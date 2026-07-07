import {
  AI_TOKEN_BANK_ACCOUNT,
  AI_TOKEN_BANK_NAME,
  AI_TOKEN_RECOMMENDED_PACKAGES,
  AI_TOKEN_UNIT_PRICE_KRW,
  formatKrw,
  getRecommendedPriceKrw,
} from './aiTokenPurchase.js'

export {
  AI_TOKEN_BANK_ACCOUNT,
  AI_TOKEN_BANK_NAME,
  AI_TOKEN_RECOMMENDED_PACKAGES,
  AI_TOKEN_UNIT_PRICE_KRW,
  formatKrw,
  getRecommendedPriceKrw,
}

/** 씨앗 1개 기본 젤리 가격 (DB farm_settings와 동기) */
export const SHOP_SEED_JELLY_COST_DEFAULT = 10

/** 씨앗 1회 최대 구매 수량 */
export const SHOP_SEED_MAX_QUANTITY = 99

/** 젤리 1개 기준 권장 단가 (원) */
export const JELLY_UNIT_PRICE_KRW = 100

/**
 * 권장 젤리 충전 패키지
 * @type {Array<{ jelly: number, priceKrw: number, description: string }>}
 */
export const JELLY_RECOMMENDED_PACKAGES = [
  {
    jelly: 50,
    priceKrw: 5000,
    description: '가챠 약 5회 (10젤리 기준)',
  },
  {
    jelly: 100,
    priceKrw: 9000,
    description: '가챠·농장 활동 여유 있게',
  },
  {
    jelly: 200,
    priceKrw: 16000,
    description: '장기 플레이용 대용량',
  },
]

/**
 * 젤리 수 → 권장 입금액 (원)
 * @param {number} jelly
 * @returns {number}
 */
export function getRecommendedJellyPriceKrw(jelly) {
  const qty = Math.max(1, Math.floor(Number(jelly) || 0))
  const matched = JELLY_RECOMMENDED_PACKAGES.find((pkg) => pkg.jelly === qty)
  if (matched) return matched.priceKrw
  return qty * JELLY_UNIT_PRICE_KRW
}

/** 충전 신청 유형 */
export const SHOP_PURCHASE_TYPES = {
  AI_TOKEN: 'ai_token',
  JELLY: 'jelly',
}
