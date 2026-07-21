/** 백로그 할일: 생성 후 이 일수 이상이면 연한 빨강 */
export const BACKLOG_STALE_WEEK_DAYS = 7

/** 백로그 할일: 생성 후 이 일수 이상이면 진한 빨강 */
export const BACKLOG_STALE_TWO_WEEKS_DAYS = 14

/** 1주 이상 (기존 스타일) */
export const BACKLOG_STALE_WEEK_CLASS = 'bg-red-200 shadow-sm hover:shadow-md'
export const BACKLOG_STALE_WEEK_CHECKBOX_CLASS = 'border-red-400 hover:border-red-500 overflow-hidden'

/** 2주 이상 (1주보다 진한 빨강) */
export const BACKLOG_STALE_TWO_WEEKS_CLASS =
  'bg-red-400 text-gray-900 shadow-md hover:shadow-lg hover:bg-red-500'
export const BACKLOG_STALE_TWO_WEEKS_CHECKBOX_CLASS =
  'border-red-600 hover:border-red-700 overflow-hidden'
