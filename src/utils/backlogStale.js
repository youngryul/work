import {
  BACKLOG_STALE_TWO_WEEKS_DAYS,
  BACKLOG_STALE_WEEK_DAYS,
} from '../constants/backlogStale.js'

/**
 * 할일 생성 시각(ms)을 숫자로 변환
 * @param {{ createdAt?: number|string, createdat?: number|string }} task
 * @returns {number|null}
 */
export function getTaskCreatedAtMs(task) {
  const raw = task?.createdAt ?? task?.createdat
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return raw
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * 생성일로부터 경과 일수
 * @param {{ createdAt?: number|string, createdat?: number|string }} task
 * @param {number} [nowMs]
 * @returns {number}
 */
export function getBacklogTaskAgeDays(task, nowMs = Date.now()) {
  const createdAt = getTaskCreatedAtMs(task)
  if (createdAt == null) return 0
  return Math.floor((nowMs - createdAt) / (1000 * 60 * 60 * 24))
}

/**
 * 생성 후 1주 이상 지난 백로그 할일
 * @param {{ createdAt?: number|string, createdat?: number|string }} task
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isBacklogStaleOneWeek(task, nowMs = Date.now()) {
  return getBacklogTaskAgeDays(task, nowMs) >= BACKLOG_STALE_WEEK_DAYS
}

/**
 * 생성 후 2주 이상 지난 백로그 할일
 * @param {{ createdAt?: number|string, createdat?: number|string }} task
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isBacklogStaleTwoWeeks(task, nowMs = Date.now()) {
  return getBacklogTaskAgeDays(task, nowMs) >= BACKLOG_STALE_TWO_WEEKS_DAYS
}

/**
 * 2주 이상 지난 할일 알림 본문
 * @param {string[]} titles
 * @returns {string}
 */
export function formatBacklogStaleNotificationMessage(titles) {
  const list = (titles || []).filter(Boolean)
  if (list.length === 0) return ''
  if (list.length === 1) {
    return `「${list[0]}」 할일이 2주 이상 지났습니다.`
  }
  if (list.length <= 3) {
    return `${list.map((t) => `「${t}」`).join(', ')} 할일이 2주 이상 지났습니다.`
  }
  return `「${list[0]}」 외 ${list.length - 1}건의 할일이 2주 이상 지났습니다.`
}
