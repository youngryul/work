/** @typedef {'book' | 'study' | 'exercise'} StudyTimerCategoryId */

export const DEFAULT_STUDY_TIMER_CATEGORY = /** @type {StudyTimerCategoryId} */ ('study')

export const STUDY_TIMER_CATEGORIES = [
  { id: /** @type {const} */ ('book'), label: '책', emoji: '📖' },
  { id: /** @type {const} */ ('study'), label: '공부', emoji: '📚' },
  { id: /** @type {const} */ ('exercise'), label: '운동', emoji: '🏃' },
]

/**
 * @param {string | null | undefined} category
 * @returns {StudyTimerCategoryId}
 */
export function normalizeStudyCategory(category) {
  if (STUDY_TIMER_CATEGORIES.some((c) => c.id === category)) {
    return /** @type {StudyTimerCategoryId} */ (category)
  }
  return DEFAULT_STUDY_TIMER_CATEGORY
}

/**
 * @param {string} categoryId
 * @returns {string}
 */
export function getStudyCategoryLabel(categoryId) {
  return (
    STUDY_TIMER_CATEGORIES.find((c) => c.id === categoryId)?.label ?? '공부'
  )
}

/**
 * @param {string} categoryId
 * @returns {string}
 */
export function getStudyCategoryEmoji(categoryId) {
  return (
    STUDY_TIMER_CATEGORIES.find((c) => c.id === categoryId)?.emoji ?? '📚'
  )
}

/** @returns {Record<StudyTimerCategoryId, number>} */
export function emptyStudyCategoryTotals() {
  return { book: 0, study: 0, exercise: 0 }
}

/**
 * @param {Record<string, number>} totals
 * @param {string | null | undefined} category
 * @param {number} seconds
 */
export function addStudySecondsToCategoryTotals(totals, category, seconds) {
  const key = normalizeStudyCategory(category)
  totals[key] = (totals[key] || 0) + (Number(seconds) || 0)
}
