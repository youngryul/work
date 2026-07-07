/** 농장 밭(작물) 상수 */

export const FARM_FIELD_COLS = 5
export const FARM_FIELD_ROWS = 4
export const CROP_MAX_STAGE = 4

/** 작물 단계: 1 씨앗 → 2 새싹 → 3 꽃 → 4 작물 */
export const CROP_STAGE_META = {
  1: { label: '씨앗', emoji: '🫘' },
  2: { label: '새싹', emoji: '🌱' },
  3: { label: '꽃', emoji: '🌸' },
  4: { label: '작물', emoji: '🌽' },
}

/**
 * @param {number} stage
 * @returns {{ label: string, emoji: string }}
 */
export function getCropStageMeta(stage) {
  return CROP_STAGE_META[stage] || CROP_STAGE_META[1]
}

/**
 * @param {number} stage
 * @returns {string}
 */
export function getCropStageLabel(stage) {
  const meta = getCropStageMeta(stage)
  if (stage >= CROP_MAX_STAGE) return `${CROP_MAX_STAGE}단계 · ${meta.label}`
  return `${stage}단계 · ${meta.label}`
}

/**
 * @param {Object} crop
 * @returns {number}
 */
export function getCropXpPercent(crop) {
  if (!crop || crop.stage >= CROP_MAX_STAGE) return 100
  const required = crop.nextStageXpRequired || 30
  if (required <= 0) return 100
  return Math.min(100, Math.round((crop.xp / required) * 100))
}

/**
 * @param {Object} crop
 * @returns {boolean}
 */
export function hasCropHarvestImage(crop) {
  return crop?.stage >= CROP_MAX_STAGE && Boolean(crop?.cropImageUrl)
}
