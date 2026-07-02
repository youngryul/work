/** 포실이 농장 상수 */

export const FARM_MAX_STAGE = 10

export const FARM_DEFAULT_IMAGES = {
  1: '/images/아기포실이.png',
  2: '/images/포실이.png',
}

export const FARM_MILK_EVENT_KEY = 'milk_feed'

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
