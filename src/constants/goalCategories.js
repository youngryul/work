/**
 * 목표 영역 상수
 * 5개 영역으로 제한
 */
export const GOAL_CATEGORY = {
  CAREER: 'CAREER',
  HEALTH: 'HEALTH',
  RELATIONSHIP: 'RELATIONSHIP',
  MONEY: 'MONEY',
  GROWTH: 'GROWTH',
}

/**
 * 목표 영역 라벨 (한글)
 */
export const GOAL_CATEGORY_LABEL = {
  [GOAL_CATEGORY.CAREER]: '커리어',
  [GOAL_CATEGORY.HEALTH]: '건강',
  [GOAL_CATEGORY.RELATIONSHIP]: '관계',
  [GOAL_CATEGORY.MONEY]: '돈',
  [GOAL_CATEGORY.GROWTH]: '성장',
}

/**
 * 목표 영역 아이콘
 */
export const GOAL_CATEGORY_ICON = {
  [GOAL_CATEGORY.CAREER]: '💼',
  [GOAL_CATEGORY.HEALTH]: '💪',
  [GOAL_CATEGORY.RELATIONSHIP]: '❤️',
  [GOAL_CATEGORY.MONEY]: '💰',
  [GOAL_CATEGORY.GROWTH]: '📚',
}

/**
 * 목표 영역 색상
 */
export const GOAL_CATEGORY_COLOR = {
  [GOAL_CATEGORY.CAREER]: 'bg-blue-100 text-blue-800 border-blue-300',
  [GOAL_CATEGORY.HEALTH]: 'bg-green-100 text-green-800 border-green-300',
  [GOAL_CATEGORY.RELATIONSHIP]: 'bg-pink-100 text-pink-800 border-pink-300',
  [GOAL_CATEGORY.MONEY]: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  [GOAL_CATEGORY.GROWTH]: 'bg-purple-100 text-purple-800 border-purple-300',
}

/**
 * 목표 상태 상수
 */
export const GOAL_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  PAUSED: 'PAUSED',
}

/**
 * 목표 상태 라벨
 */
export const GOAL_STATUS_LABEL = {
  [GOAL_STATUS.ACTIVE]: '진행 중',
  [GOAL_STATUS.COMPLETED]: '완료',
  [GOAL_STATUS.PAUSED]: '보류',
}

/**
 * 월별 목표 상태 상수
 */
export const MONTHLY_GOAL_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  PAUSED: 'PAUSED',
}

/**
 * 월별 목표 상태 라벨
 */
export const MONTHLY_GOAL_STATUS_LABEL = {
  [MONTHLY_GOAL_STATUS.IN_PROGRESS]: '진행 중',
  [MONTHLY_GOAL_STATUS.COMPLETED]: '완료',
  [MONTHLY_GOAL_STATUS.PAUSED]: '보류',
}

/**
 * 최대 목표 개수 제한
 */
export const MAX_YEARLY_GOALS = 5 // 연간 목표 최대 5개
export const MAX_MONTHLY_GOALS = 3 // 월별 목표 최대 3개

