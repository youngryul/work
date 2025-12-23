/**
 * 기록 타입 상수
 */
export const RECORD_TYPE = {
  MEETING: 'MEETING',
  DECISION: 'DECISION',
  ISSUE: 'ISSUE',
  IDEA: 'IDEA',
  RETROSPECT: 'RETROSPECT',
}

/**
 * 기록 타입 라벨 (한글)
 */
export const RECORD_TYPE_LABEL = {
  [RECORD_TYPE.MEETING]: '회의록',
  [RECORD_TYPE.DECISION]: '결정사항',
  [RECORD_TYPE.ISSUE]: '이슈',
  [RECORD_TYPE.IDEA]: '아이디어',
  [RECORD_TYPE.RETROSPECT]: '회고',
}

/**
 * 기록 타입 색상
 */
export const RECORD_TYPE_COLOR = {
  [RECORD_TYPE.MEETING]: 'bg-blue-100 text-blue-800',
  [RECORD_TYPE.DECISION]: 'bg-green-100 text-green-800',
  [RECORD_TYPE.ISSUE]: 'bg-red-100 text-red-800',
  [RECORD_TYPE.IDEA]: 'bg-purple-100 text-purple-800',
  [RECORD_TYPE.RETROSPECT]: 'bg-yellow-100 text-yellow-800',
}

/**
 * Action Item 상태 상수
 */
export const ACTION_ITEM_STATUS = {
  TODO: 'TODO',
  DOING: 'DOING',
  DONE: 'DONE',
}

/**
 * Action Item 상태 라벨
 */
export const ACTION_ITEM_STATUS_LABEL = {
  [ACTION_ITEM_STATUS.TODO]: '할 일',
  [ACTION_ITEM_STATUS.DOING]: '진행 중',
  [ACTION_ITEM_STATUS.DONE]: '완료',
}

/**
 * Action Item 상태 색상
 */
export const ACTION_ITEM_STATUS_COLOR = {
  [ACTION_ITEM_STATUS.TODO]: 'bg-gray-100 text-gray-800',
  [ACTION_ITEM_STATUS.DOING]: 'bg-blue-100 text-blue-800',
  [ACTION_ITEM_STATUS.DONE]: 'bg-green-100 text-green-800',
}
