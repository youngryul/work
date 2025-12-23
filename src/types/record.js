/**
 * 기록 타입 정의
 */

/**
 * @typedef {Object} ActionItem
 * @property {string} id - Action Item 고유 ID
 * @property {string} task - 할 일 내용
 * @property {string|null} dueDate - 기한 (YYYY-MM-DD 형식 또는 null)
 * @property {string} status - 상태 (TODO, DOING, DONE)
 */

/**
 * @typedef {Object} Decision
 * @property {string} content - 결정 내용
 * @property {string} reason - 결정 이유
 * @property {string} impact - 영향 범위
 */

/**
 * @typedef {Object} ProjectRecord
 * @property {string} id - 기록 고유 ID
 * @property {string} projectName - 프로젝트명
 * @property {string} type - 기록 타입 (MEETING, DECISION, ISSUE, IDEA, RETROSPECT)
 * @property {string} date - 작성일 (YYYY-MM-DD 형식)
 * @property {string} title - 제목
 * @property {string} background - 배경 (Markdown)
 * @property {string} discussion - 논의 내용 (Markdown)
 * @property {string} problem - 문제/맥락 (Markdown)
 * @property {Decision|null} decision - 결정 사항 (선택)
 * @property {ActionItem[]} actionItems - Action Item 목록
 * @property {string} createdAt - 생성일시 (ISO 8601)
 * @property {string} updatedAt - 수정일시 (ISO 8601)
 */
