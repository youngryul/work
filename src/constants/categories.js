/**
 * 할 일 카테고리 상수 정의
 */
export const CATEGORIES = {
  WORK: '작업',
  STUDY: '공부',
  THINK: '생각',
  PERSONAL: '개인',
}

/**
 * 카테고리 이모지 매핑
 */
export const CATEGORY_EMOJIS = {
  [CATEGORIES.WORK]: '💻',
  [CATEGORIES.STUDY]: '📚',
  [CATEGORIES.THINK]: '🧠',
  [CATEGORIES.PERSONAL]: '❤️',
}

/**
 * 기본 카테고리
 */
export const DEFAULT_CATEGORY = CATEGORIES.WORK

/**
 * 최대 오늘 할 일 개수
 */
export const MAX_TODAY_TASKS = 5

