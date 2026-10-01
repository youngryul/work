/** 피드백 유형 */
export const FEEDBACK_CATEGORIES = [
  { id: 'feature', label: '기능 제안', icon: '💡', className: 'bg-amber-100 text-amber-800' },
  { id: 'bug', label: '버그·오류', icon: '🐞', className: 'bg-red-100 text-red-800' },
  { id: 'improvement', label: '불편·개선', icon: '🛠️', className: 'bg-blue-100 text-blue-800' },
  { id: 'other', label: '기타 의견', icon: '💬', className: 'bg-gray-100 text-gray-700' },
]

/** 처리 상태 */
export const FEEDBACK_STATUSES = [
  { id: 'pending', label: '접수', className: 'bg-gray-100 text-gray-700' },
  { id: 'reviewing', label: '검토 중', className: 'bg-amber-100 text-amber-800' },
  { id: 'done', label: '반영 완료', className: 'bg-green-100 text-green-800' },
  { id: 'rejected', label: '보류', className: 'bg-stone-200 text-stone-700' },
]

export const FEEDBACK_TITLE_MAX_LENGTH = 100
export const FEEDBACK_CONTENT_MAX_LENGTH = 2000

/**
 * @param {string} id
 */
export function getFeedbackCategory(id) {
  return FEEDBACK_CATEGORIES.find((item) => item.id === id) || FEEDBACK_CATEGORIES[3]
}

/**
 * @param {string} id
 */
export function getFeedbackStatus(id) {
  return FEEDBACK_STATUSES.find((item) => item.id === id) || FEEDBACK_STATUSES[0]
}
