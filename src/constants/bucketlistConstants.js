/**
 * 버킷리스트 관련 상수
 */

/**
 * 버킷리스트 상태
 */
export const BUCKETLIST_STATUS = {
  NOT_COMPLETED: 'NOT_COMPLETED', // 미완료
  COMPLETED: 'COMPLETED', // 완료
}

/**
 * 버킷리스트 상태 라벨 (한글)
 */
export const BUCKETLIST_STATUS_LABELS = {
  [BUCKETLIST_STATUS.NOT_COMPLETED]: '미완료',
  [BUCKETLIST_STATUS.COMPLETED]: '완료',
}

/**
 * 버킷리스트 카테고리
 */
export const BUCKETLIST_CATEGORY = {
  TRAVEL: 'TRAVEL', // 여행
  CAREER: 'CAREER', // 커리어
  HEALTH: 'HEALTH', // 건강
  RELATIONSHIP: 'RELATIONSHIP', // 관계
  HOBBY: 'HOBBY', // 취미
  LEARNING: 'LEARNING', // 학습
  FINANCIAL: 'FINANCIAL', // 재정
  EXPERIENCE: 'EXPERIENCE', // 경험
}

/**
 * 버킷리스트 카테고리 라벨 (한글)
 */
export const BUCKETLIST_CATEGORY_LABELS = {
  [BUCKETLIST_CATEGORY.TRAVEL]: '여행',
  [BUCKETLIST_CATEGORY.CAREER]: '커리어',
  [BUCKETLIST_CATEGORY.HEALTH]: '건강',
  [BUCKETLIST_CATEGORY.RELATIONSHIP]: '관계',
  [BUCKETLIST_CATEGORY.HOBBY]: '취미',
  [BUCKETLIST_CATEGORY.LEARNING]: '학습',
  [BUCKETLIST_CATEGORY.FINANCIAL]: '재정',
  [BUCKETLIST_CATEGORY.EXPERIENCE]: '경험',
}

/**
 * 버킷리스트 카테고리 색상
 */
export const BUCKETLIST_CATEGORY_COLORS = {
  [BUCKETLIST_CATEGORY.TRAVEL]: 'bg-blue-100 text-blue-800',
  [BUCKETLIST_CATEGORY.CAREER]: 'bg-purple-100 text-purple-800',
  [BUCKETLIST_CATEGORY.HEALTH]: 'bg-green-100 text-green-800',
  [BUCKETLIST_CATEGORY.RELATIONSHIP]: 'bg-pink-100 text-pink-800',
  [BUCKETLIST_CATEGORY.HOBBY]: 'bg-yellow-100 text-yellow-800',
  [BUCKETLIST_CATEGORY.LEARNING]: 'bg-indigo-100 text-indigo-800',
  [BUCKETLIST_CATEGORY.FINANCIAL]: 'bg-emerald-100 text-emerald-800',
  [BUCKETLIST_CATEGORY.EXPERIENCE]: 'bg-orange-100 text-orange-800',
}

/**
 * 버킷리스트 상태 색상
 */
export const BUCKETLIST_STATUS_COLORS = {
  [BUCKETLIST_STATUS.NOT_COMPLETED]: 'bg-gray-100 text-gray-700',
  [BUCKETLIST_STATUS.COMPLETED]: 'bg-green-100 text-green-700',
}

