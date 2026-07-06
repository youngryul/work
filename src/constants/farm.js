/** 포실이 농장 상수 */

export const FARM_MAX_STAGE = 10

export const FARM_DEFAULT_IMAGES = {
  1: '/images/아기포실이.png',
  2: '/images/포실이.png',
}

export const FARM_MILK_EVENT_KEY = 'milk_feed'

/** 2단계 달성 시 지급되는 환영 씨앗 개수 */
export const FARM_STAGE2_WELCOME_SEED_COUNT = 1

/** 1~2단계 먹이 젤리 */
export const FARM_FEED_JELLY_COST_DEFAULT = 3

/** 3단계 이상 먹이 젤리 */
export const FARM_FEED_JELLY_COST_STAGE_3_PLUS = 5

/** 3단계부터 먹이 젤리 상향 */
export const FARM_FEED_JELLY_STAGE_THRESHOLD = 3

/**
 * @param {number} stage
 * @param {Record<string, string>} [settings]
 * @returns {number}
 */
export function getFarmFeedJellyCost(stage, settings = {}) {
  if (stage >= FARM_FEED_JELLY_STAGE_THRESHOLD) {
    const fromSettings = settings.milk_feed_jelly_cost_stage_3_plus
    return fromSettings != null ? Number(fromSettings) : FARM_FEED_JELLY_COST_STAGE_3_PLUS
  }
  const fromSettings = settings.milk_feed_jelly_cost_default
  return fromSettings != null ? Number(fromSettings) : FARM_FEED_JELLY_COST_DEFAULT
}

/**
 * @param {number} stage
 * @returns {string}
 */
export function getFarmStageLabel(stage) {
  if (stage >= FARM_MAX_STAGE) return `${FARM_MAX_STAGE}단계 · 최고 성장`
  if (stage === 1) return '1단계 · 아기 포실이'
  if (stage >= 2) return `${stage}단계 · 성장 중`
  return `${stage}단계`
}

/**
 * @param {number} stage
 * @param {Record<string, string>} [settings]
 * @returns {string}
 */
export function getFarmStageImage(stage, settings = {}) {
  if (stage === 1) {
    return settings.stage_1_image || FARM_DEFAULT_IMAGES[1]
  }
  return settings.stage_2_image || FARM_DEFAULT_IMAGES[2]
}
