/** 농장 수확·창고·캐릭터 요청 UI 상수 */

export const FARM_HARVEST_READY_MESSAGE =
  '밭의 모든 작물이 다 자랐어요! 수확하면 창고에 보관돼요.'

export const FARM_CROP_REQUEST_HINT =
  '포실이 친구들이 창고 작물을 부탁해요. 많이 줄수록 젤리도 더 많이 받을 수 있어요!'

/** DB `farm_settings` 기본값과 동일 */
export const FARM_CROP_REQUEST_JELLY_SETTING_KEYS = {
  minBase: 'crop_request_jelly_min_base',
  maxBase: 'crop_request_jelly_max_base',
  minPerCrop: 'crop_request_jelly_min_per_crop',
  maxPerCrop: 'crop_request_jelly_max_per_crop',
}

const JELLY_DEFAULTS = {
  minBase: 2,
  maxBase: 5,
  minPerCrop: 1,
  maxPerCrop: 4,
}

/**
 * 작물 요청 젤리 보상 범위 (서버 calc_farm_crop_request_jelly와 동일 공식)
 * @param {number} quantity
 * @param {Record<string, string>} [settingsMap] getFarmSettingsMap() 결과
 * @returns {{ min: number, max: number }}
 */
export function getCropRequestJellyRange(quantity, settingsMap = {}) {
  const parse = (key, fallback) => {
    const raw = settingsMap[key]
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  }

  let minBase = parse(FARM_CROP_REQUEST_JELLY_SETTING_KEYS.minBase, JELLY_DEFAULTS.minBase)
  let maxBase = parse(FARM_CROP_REQUEST_JELLY_SETTING_KEYS.maxBase, JELLY_DEFAULTS.maxBase)
  let minPer = parse(FARM_CROP_REQUEST_JELLY_SETTING_KEYS.minPerCrop, JELLY_DEFAULTS.minPerCrop)
  let maxPer = parse(FARM_CROP_REQUEST_JELLY_SETTING_KEYS.maxPerCrop, JELLY_DEFAULTS.maxPerCrop)

  if (maxBase < minBase) maxBase = minBase
  if (maxPer < minPer) maxPer = minPer

  const q = Math.max(1, Math.floor(Number(quantity)) || 1)

  return {
    min: minBase + q * minPer,
    max: maxBase + q * maxPer,
  }
}

/**
 * @param {number} quantity
 * @param {Record<string, string>} [settingsMap]
 * @returns {string}
 */
export function formatCropRequestJellyPreview(quantity, settingsMap = {}) {
  const { min, max } = getCropRequestJellyRange(quantity, settingsMap)
  if (min === max) return `젤리 ${min}개`
  return `젤리 ${min}~${max}개`
}
