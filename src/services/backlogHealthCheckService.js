import { supabase } from '../config/supabase.js'
import { getOpenAIProxyToken, OPENAI_CHAT_COMPLETIONS_URL } from './openaiProxy.js'
import {
  BACKLOG_HEALTH_HISTORY_LIMIT,
  BACKLOG_HEALTH_LAST_RESULT_STORAGE_KEY,
  BACKLOG_HEALTH_LOOKBACK_DAYS,
  BACKLOG_HEALTH_MAX_TASKS_FOR_AI,
  BACKLOG_HEALTH_MAX_TOKENS,
  BACKLOG_HEALTH_MIN_COMPLETED_FOR_PATTERN,
  BACKLOG_HEALTH_MODEL,
  BACKLOG_HEALTH_REPEATED_POSTPONE_COUNT,
  BACKLOG_HEALTH_SYSTEM_PROMPT,
  BACKLOG_HEALTH_THROUGHPUT_DAYS,
  BACKLOG_HEALTH_UPCOMING_DAYS,
  BOTTLENECK_TYPE_LABELS,
  WEEKDAY_LABELS,
} from '../constants/backlogHealthCheck.js'
import { BACKLOG_STALE_TWO_WEEKS_DAYS, BACKLOG_STALE_WEEK_DAYS } from '../constants/backlogStale.js'
import {
  TIME_SLOTS,
  formatMinutesAsTime,
  getPastTimeSlots,
  getSlotDayDate,
  getTimeSlotForDate,
  getTimeSlotInfo,
  getTimeSlotTimes,
  isValidTimeSlot,
} from '../constants/timeSlots.js'
import {
  assertSufficientTokensForBacklogAssistant,
  consumeTokensForBacklogAssistant,
} from './aiTokenService.js'
import { getSchedulesByMonth } from './scheduleCalendarService.js'
import { getStudySessionsSince } from './studyTimeService.js'
import {
  getBacklogTasks,
  getCompletedTasksSince,
  getTodayTasks,
  moveToToday,
  updateTask,
} from './taskService.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/** 저장 결과 형식 버전 (형식이 바뀌면 올려서 예전 캐시 무시) */
const RESULT_VERSION = 2

/** 점검 기록 테이블 (supabase-backlog-health-checks.sql) */
const HISTORY_TABLE = 'backlog_health_checks'

const DAY_MS = 24 * 60 * 60 * 1000
const SLOT_KEYS = TIME_SLOTS.map((slot) => slot.key)
const THROUGHPUT_WEEKS = BACKLOG_HEALTH_THROUGHPUT_DAYS / 7

/** 카테고리별 "잘 되는 요일·시간대"로 인정할 최소 완료 수 */
const MIN_COUNT_FOR_BEST = 3

/**
 * @typedef {Object} BacklogHealthStats
 * @property {number} lookbackDays
 * @property {number} completedInPeriod
 * @property {boolean} dataIsSparse
 * @property {{ total: number, staleWeek: number, staleTwoWeeks: number, bounced: number, repeatedPostpone: number, overdueScheduled: number, avgAgeDays: number, oldestAgeDays: number }} backlog
 * @property {{ total: number, pending: number }} today
 * @property {{ completedRecent: number, createdRecent: number, perWeek: number, netPerWeek: number, activeDays: number, avgPerActiveDay: number, weeksToClear: number | null }} throughput
 * @property {{ cells: number[][], max: number, weekdayTotals: number[], slotTotals: number[] }} heatmap
 * @property {Array<{ weekday: number, slot: string, count: number }>} topCells
 * @property {Array<{ category: string, backlogCount: number, avgAgeDays: number, bouncedCount: number, completedRecent: number, perWeek: number, weeksToClear: number | null, bestWeekday: number | null, bestSlot: string | null, medianLeadDays: number | null }>} categories
 * @property {{ medianDays: number | null, sameDayRate: number | null }} leadTime
 * @property {{ planned: number, onTime: number, rate: number | null }} slotAdherence
 * @property {{ completedAfterPostpone: number, avgPostponeBeforeDone: number | null }} postpone
 * @property {{ cells: number[][], max: number, totalMinutes: number, sessionCount: number }} focus - 요일×시간대 집중(공부·뽀모도로) 분
 * @property {Array<{ dateString: string, weekday: number, count: number, tags: string[] }>} upcomingSchedule - 오늘부터 7일 일정 개수
 */

/**
 * @typedef {Object} BacklogHealthTaskRef
 * @property {string} id
 * @property {string} title
 * @property {string} category
 * @property {number} ageDays
 * @property {boolean} bounced
 * @property {number} postponeCount
 * @property {boolean} overdue
 */

/**
 * @typedef {Object} BacklogHealthAiResult
 * @property {string} summary
 * @property {Array<{ taskRef: string, type: string, reason: string, action: string }>} bottlenecks
 * @property {{ category: string, reason: string } | null} categoryBottleneck
 * @property {string[]} patternInsights
 * @property {Array<{ id: string, label: string, weekday: number, timeSlot: string, taskRefs: string[], reason: string }>} batches
 * @property {Array<{ id: string, weekday: number, timeSlot: string, taskRefs: string[], reason: string }>} weeklyPlan
 * @property {Array<{ taskRef: string, reason: string }>} quickWins
 * @property {Array<{ taskRef: string, reason: string }>} cleanupCandidates
 * @property {string[]} tips
 */

/**
 * @typedef {Object} BacklogHealthTrend
 * @property {number} previousCheckedAt
 * @property {number} daysSince
 * @property {Record<string, number | null>} previousMetrics
 * @property {number} previousBottleneckCount
 * @property {number} resolvedBottleneckCount - 지난 점검 병목 중 백로그에서 빠진 수
 */

/**
 * @typedef {Object} BacklogHealthResult
 * @property {number} version
 * @property {string} userId
 * @property {number} checkedAt
 * @property {BacklogHealthStats} stats
 * @property {BacklogHealthAiResult} ai
 * @property {Record<string, BacklogHealthTaskRef>} taskRefs
 * @property {BacklogHealthTrend | null} trend
 */

/**
 * @typedef {Object} BacklogHealthHistoryItem
 * @property {string} id
 * @property {number} checkedAt
 * @property {Record<string, number | null>} metrics
 * @property {string} summary
 * @property {string[]} bottleneckTaskIds
 */

/* ───────────────────────── 날짜·숫자 유틸 ───────────────────────── */

/**
 * @param {Date} date
 * @returns {string} YYYY-MM-DD (로컬)
 */
function toDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * @param {string} dateString - YYYY-MM-DD
 * @returns {string} 예: 11/27(금)
 */
export function formatShortDateLabel(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  const weekday = WEEKDAY_LABELS[new Date(year, month - 1, day).getDay()]
  return `${month}/${day}(${weekday})`
}

/** @param {number} value */
function round1(value) {
  return Math.round(value * 10) / 10
}

/**
 * @param {number[]} values
 * @returns {number | null}
 */
function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * 최댓값 인덱스 (최댓값이 minCount 미만이면 null)
 * @param {number[]} counts
 * @param {number} minCount
 * @returns {number | null}
 */
function argMax(counts, minCount) {
  let bestIndex = -1
  counts.forEach((count, index) => {
    if (bestIndex < 0 || count > counts[bestIndex]) bestIndex = index
  })
  return bestIndex >= 0 && counts[bestIndex] >= minCount ? bestIndex : null
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function toTimestamp(value) {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? num : null
}

/** 요일(7) × 시간대 빈 표 */
function createWeekdaySlotGrid() {
  return Array.from({ length: 7 }, () => Array(SLOT_KEYS.length).fill(0))
}

/* ───────────────────────── 백로그 할일 해석 ───────────────────────── */

/**
 * 백로그 할일 하나의 대기 상태 계산
 * @param {Object} task
 * @param {number} now
 * @param {string} todayString
 */
function describeBacklogTask(task, now, todayString) {
  const createdAt = toTimestamp(task.createdAt)
  const movedAt = toTimestamp(task.movedToTodayAt)
  const postponeCount = Number(task.postponeCount) || 0
  const ageDays = createdAt ? Math.max(0, Math.floor((now - createdAt) / DAY_MS)) : 0
  // 미룸 횟수가 기록되기 전(마이그레이션 이전) 할일은 movedToTodayAt 으로 "미룬 적 있음"만 판단
  const bounced = postponeCount > 0 || Boolean(movedAt)
  const daysSinceMoved = movedAt ? Math.max(0, Math.floor((now - movedAt) / DAY_MS)) : null
  const overdue = Boolean(task.scheduledDate && task.scheduledDate < todayString)

  // 막힘 점수: 오래될수록, 여러 번 미뤘을수록, 예약일이 지났을수록 높음
  const postponeScore = postponeCount > 0 ? postponeCount * 5 : bounced ? 10 : 0
  const stuckScore = ageDays + postponeScore + (overdue ? 10 : 0) + (task.isKey ? 5 : 0)

  return {
    task,
    ageDays,
    bounced,
    postponeCount,
    daysSinceMoved,
    overdue,
    stuckScore,
  }
}

/* ───────────────────────── 통계 집계 (토큰 사용 없음) ───────────────────────── */

/**
 * 오늘부터 N일 동안 날짜별 일정 개수·태그
 * @param {Array<{ scheduleDate: string, endDate?: string, tag?: string }>} schedules - 펼친 일정
 * @param {number} now
 * @returns {BacklogHealthStats['upcomingSchedule']}
 */
function buildUpcomingSchedule(schedules, now) {
  return Array.from({ length: BACKLOG_HEALTH_UPCOMING_DAYS }, (_, offset) => {
    const date = new Date(now)
    date.setDate(date.getDate() + offset)
    const dateString = toDateString(date)
    const onDay = schedules.filter(
      (item) => item.scheduleDate <= dateString && (item.endDate || item.scheduleDate) >= dateString,
    )
    return {
      dateString,
      weekday: date.getDay(),
      count: onDay.length,
      tags: [...new Set(onDay.map((item) => item.tag).filter(Boolean))].slice(0, 3),
    }
  })
}

/**
 * 백로그·완료·집중·일정 기록으로 점검 통계 계산 (순수 함수)
 * @param {{
 *   backlog: Array,
 *   completed: Array,
 *   todayTasks: Array,
 *   focusSessions?: Array<{ recordedAt: number, durationSeconds: number }>,
 *   schedules?: Array<{ scheduleDate: string, endDate?: string, tag?: string }>,
 *   now?: number,
 *   times?: { morning: number, afternoon: number, evening: number },
 * }} params
 * @returns {BacklogHealthStats}
 */
export function buildBacklogHealthStats({
  backlog,
  completed,
  todayTasks,
  focusSessions = [],
  schedules = [],
  now = Date.now(),
  times = getTimeSlotTimes(),
}) {
  const todayString = toDateString(new Date(now))
  const recentSince = now - BACKLOG_HEALTH_THROUGHPUT_DAYS * DAY_MS

  /** @type {Map<string, { category: string, backlogCount: number, ageSum: number, bouncedCount: number, completedRecent: number, weekday: number[], slot: number[], leadDays: number[] }>} */
  const categoryMap = new Map()
  const getCategoryEntry = (name) => {
    const key = name || '미분류'
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        category: key,
        backlogCount: 0,
        ageSum: 0,
        bouncedCount: 0,
        completedRecent: 0,
        weekday: Array(7).fill(0),
        slot: Array(SLOT_KEYS.length).fill(0),
        leadDays: [],
      })
    }
    return categoryMap.get(key)
  }

  // 1) 백로그 현황
  const described = backlog.map((task) => describeBacklogTask(task, now, todayString))
  described.forEach(({ task, ageDays, bounced }) => {
    const entry = getCategoryEntry(task.category)
    entry.backlogCount += 1
    entry.ageSum += ageDays
    if (bounced) entry.bouncedCount += 1
  })
  const ages = described.map((item) => item.ageDays)

  // 2) 완료 패턴 (요일 × 시간대, 카테고리, 리드타임, 계획 시간대 적중, 미룬 뒤 완료)
  const cells = createWeekdaySlotGrid()
  const leadDays = []
  const activeDays = new Set()
  const postponeBeforeDone = []
  let completedRecent = 0
  let planned = 0
  let onTime = 0

  completed.forEach((task) => {
    const completedAt = toTimestamp(task.completedAt)
    if (!completedAt) return

    const slotKey = getTimeSlotForDate(completedAt, times)
    const slotIndex = SLOT_KEYS.indexOf(slotKey)
    const dayDate = getSlotDayDate(completedAt, times)
    const weekday = dayDate.getDay()

    cells[weekday][slotIndex] += 1

    const entry = getCategoryEntry(task.category)
    entry.weekday[weekday] += 1
    entry.slot[slotIndex] += 1

    const createdAt = toTimestamp(task.createdAt)
    if (createdAt && completedAt >= createdAt) {
      const days = (completedAt - createdAt) / DAY_MS
      leadDays.push(days)
      entry.leadDays.push(days)
    }

    if (isValidTimeSlot(task.timeSlot)) {
      planned += 1
      if (task.timeSlot === slotKey) onTime += 1
    }

    const postponeCount = Number(task.postponeCount) || 0
    if (postponeCount > 0) postponeBeforeDone.push(postponeCount)

    if (completedAt >= recentSince) {
      completedRecent += 1
      entry.completedRecent += 1
      activeDays.add(toDateString(dayDate))
    }
  })

  // 3) 집중 시간 (세션 중간 시각 기준으로 요일·시간대 배정)
  const focusCells = createWeekdaySlotGrid()
  let focusTotalMinutes = 0
  focusSessions.forEach((session) => {
    const minutes = session.durationSeconds / 60
    if (!(minutes > 0) || !Number.isFinite(session.recordedAt)) return
    const midpoint = session.recordedAt - (session.durationSeconds * 1000) / 2
    const slotIndex = SLOT_KEYS.indexOf(getTimeSlotForDate(midpoint, times))
    const weekday = getSlotDayDate(midpoint, times).getDay()
    focusCells[weekday][slotIndex] += minutes
    focusTotalMinutes += minutes
  })
  const roundedFocusCells = focusCells.map((row) => row.map((minutes) => Math.round(minutes)))

  // 4) 최근 유입량 (백로그·오늘·완료 전체에서 최근 생성된 할일, id 기준 중복 제거)
  const recentCreatedIds = new Set()
  ;[...backlog, ...todayTasks, ...completed].forEach((task) => {
    const createdAt = toTimestamp(task.createdAt)
    if (createdAt && createdAt >= recentSince) recentCreatedIds.add(task.id)
  })
  const createdRecent = recentCreatedIds.size

  const perWeek = round1(completedRecent / THROUGHPUT_WEEKS)
  const flatCells = cells.flatMap((row, weekday) =>
    row.map((count, slotIndex) => ({ weekday, slot: SLOT_KEYS[slotIndex], count })),
  )

  const categories = [...categoryMap.values()]
    .map((entry) => {
      const catPerWeek = round1(entry.completedRecent / THROUGHPUT_WEEKS)
      const bestSlotIndex = argMax(entry.slot, MIN_COUNT_FOR_BEST)
      const leadMedian = median(entry.leadDays)
      return {
        category: entry.category,
        backlogCount: entry.backlogCount,
        avgAgeDays: entry.backlogCount ? Math.round(entry.ageSum / entry.backlogCount) : 0,
        bouncedCount: entry.bouncedCount,
        completedRecent: entry.completedRecent,
        perWeek: catPerWeek,
        weeksToClear: entry.backlogCount && catPerWeek > 0 ? round1(entry.backlogCount / catPerWeek) : null,
        bestWeekday: argMax(entry.weekday, MIN_COUNT_FOR_BEST),
        bestSlot: bestSlotIndex === null ? null : SLOT_KEYS[bestSlotIndex],
        medianLeadDays: leadMedian === null ? null : round1(leadMedian),
      }
    })
    .sort((a, b) => b.backlogCount - a.backlogCount || b.completedRecent - a.completedRecent)
    .slice(0, 10)

  const leadMedian = median(leadDays)

  return {
    lookbackDays: BACKLOG_HEALTH_LOOKBACK_DAYS,
    completedInPeriod: completed.length,
    dataIsSparse: completed.length < BACKLOG_HEALTH_MIN_COMPLETED_FOR_PATTERN,
    backlog: {
      total: backlog.length,
      staleWeek: ages.filter((age) => age >= BACKLOG_STALE_WEEK_DAYS).length,
      staleTwoWeeks: ages.filter((age) => age >= BACKLOG_STALE_TWO_WEEKS_DAYS).length,
      bounced: described.filter((item) => item.bounced).length,
      repeatedPostpone: described.filter(
        (item) => item.postponeCount >= BACKLOG_HEALTH_REPEATED_POSTPONE_COUNT,
      ).length,
      overdueScheduled: described.filter((item) => item.overdue).length,
      avgAgeDays: ages.length ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length) : 0,
      oldestAgeDays: ages.length ? Math.max(...ages) : 0,
    },
    today: {
      total: todayTasks.length,
      pending: todayTasks.filter((task) => !task.completed).length,
    },
    throughput: {
      completedRecent,
      createdRecent,
      perWeek,
      // 양수면 백로그가 늘어나는 중 (들어오는 할일 > 끝내는 할일)
      netPerWeek: round1((createdRecent - completedRecent) / THROUGHPUT_WEEKS),
      activeDays: activeDays.size,
      avgPerActiveDay: activeDays.size ? round1(completedRecent / activeDays.size) : 0,
      weeksToClear: perWeek > 0 ? round1(backlog.length / perWeek) : null,
    },
    heatmap: {
      cells,
      max: Math.max(0, ...flatCells.map((cell) => cell.count)),
      weekdayTotals: cells.map((row) => row.reduce((sum, count) => sum + count, 0)),
      slotTotals: SLOT_KEYS.map((_, slotIndex) => cells.reduce((sum, row) => sum + row[slotIndex], 0)),
    },
    topCells: flatCells
      .filter((cell) => cell.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    categories,
    leadTime: {
      medianDays: leadMedian === null ? null : round1(leadMedian),
      sameDayRate: leadDays.length
        ? Math.round((leadDays.filter((days) => days < 1).length / leadDays.length) * 100)
        : null,
    },
    slotAdherence: {
      planned,
      onTime,
      rate: planned ? Math.round((onTime / planned) * 100) : null,
    },
    postpone: {
      completedAfterPostpone: postponeBeforeDone.length,
      avgPostponeBeforeDone: postponeBeforeDone.length
        ? round1(postponeBeforeDone.reduce((sum, count) => sum + count, 0) / postponeBeforeDone.length)
        : null,
    },
    focus: {
      cells: roundedFocusCells,
      max: Math.max(0, ...roundedFocusCells.flat()),
      totalMinutes: Math.round(focusTotalMinutes),
      sessionCount: focusSessions.length,
    },
    upcomingSchedule: buildUpcomingSchedule(schedules, now),
  }
}

/* ───────────────────────── 점검 기록 (DB) ───────────────────────── */

/**
 * 추이 비교용 핵심 지표만 추리기
 * @param {BacklogHealthStats} stats
 * @returns {Record<string, number | null>}
 */
function buildHistoryMetrics(stats) {
  return {
    backlogTotal: stats.backlog.total,
    staleTwoWeeks: stats.backlog.staleTwoWeeks,
    bounced: stats.backlog.bounced,
    repeatedPostpone: stats.backlog.repeatedPostpone,
    overdueScheduled: stats.backlog.overdueScheduled,
    avgAgeDays: stats.backlog.avgAgeDays,
    perWeek: stats.throughput.perWeek,
    netPerWeek: stats.throughput.netPerWeek,
    weeksToClear: stats.throughput.weeksToClear,
  }
}

/**
 * 최근 점검 기록 (최신순). 테이블이 아직 없으면 빈 배열
 * @param {number} [limit]
 * @returns {Promise<BacklogHealthHistoryItem[]>}
 */
export async function getBacklogHealthHistory(limit = BACKLOG_HEALTH_HISTORY_LIMIT) {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select('id, checked_at, metrics, summary, bottleneck_task_ids')
    .eq('user_id', userId)
    .order('checked_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('점검 기록 조회 실패 (마이그레이션 확인 필요):', error.message)
    return []
  }

  return (data || []).map((row) => ({
    id: row.id,
    checkedAt: Date.parse(row.checked_at),
    metrics: row.metrics || {},
    summary: row.summary || '',
    bottleneckTaskIds: row.bottleneck_task_ids || [],
  }))
}

/**
 * 점검 기록 저장 (실패해도 점검 결과 표시는 계속)
 * @param {string} userId
 * @param {BacklogHealthResult} result
 */
async function saveBacklogHealthRecord(userId, result) {
  const bottleneckTaskIds = result.ai.bottlenecks
    .map((item) => result.taskRefs[item.taskRef]?.id)
    .filter(Boolean)

  const { error } = await supabase.from(HISTORY_TABLE).insert({
    user_id: userId,
    checked_at: new Date(result.checkedAt).toISOString(),
    metrics: buildHistoryMetrics(result.stats),
    summary: result.ai.summary,
    bottleneck_task_ids: bottleneckTaskIds,
  })

  if (error) {
    console.warn('점검 기록 저장 실패 (마이그레이션 확인 필요):', error.message)
  }
}

/**
 * 지난 점검과 비교
 * @param {BacklogHealthHistoryItem | undefined} previous
 * @param {Array} backlog - 현재 백로그
 * @param {number} now
 * @returns {BacklogHealthTrend | null}
 */
function buildTrend(previous, backlog, now) {
  if (!previous || !Number.isFinite(previous.checkedAt)) return null
  const currentIds = new Set(backlog.map((task) => task.id))
  const previousIds = previous.bottleneckTaskIds || []
  return {
    previousCheckedAt: previous.checkedAt,
    daysSince: Math.max(0, Math.round((now - previous.checkedAt) / DAY_MS)),
    previousMetrics: previous.metrics,
    previousBottleneckCount: previousIds.length,
    resolvedBottleneckCount: previousIds.filter((id) => !currentIds.has(id)).length,
  }
}

/* ───────────────────────── 외부 기록 모으기 (실패해도 점검은 계속) ───────────────────────── */

/**
 * 오늘부터 N일을 덮는 달의 일정 (반복 일정 펼친 상태, 월 경계 중복 제거)
 * @param {number} now
 */
async function getUpcomingSchedules(now) {
  const months = new Map()
  for (let offset = 0; offset < BACKLOG_HEALTH_UPCOMING_DAYS; offset += 1) {
    const date = new Date(now)
    date.setDate(date.getDate() + offset)
    months.set(`${date.getFullYear()}-${date.getMonth() + 1}`, [date.getFullYear(), date.getMonth() + 1])
  }
  const lists = await Promise.all([...months.values()].map(([year, month]) => getSchedulesByMonth(year, month)))
  const seen = new Set()
  return lists.flat().filter((item) => {
    const key = `${item.seriesId ?? item.id}|${item.scheduleDate}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {T} fallback
 * @param {string} label
 * @returns {Promise<T>}
 */
async function withFallback(promise, fallback, label) {
  try {
    return await promise
  } catch (error) {
    console.warn(`${label} 불러오기 실패 (점검은 계속):`, error?.message || error)
    return fallback
  }
}

/* ───────────────────────── AI 입력 만들기 ───────────────────────── */

/**
 * 요일×시간대 표 → { 월: { morning, afternoon, evening }, ... }
 * @param {number[][]} cells
 */
function gridToLabeledObject(cells) {
  return Object.fromEntries(
    WEEKDAY_LABELS.map((label, weekday) => [
      label,
      Object.fromEntries(SLOT_KEYS.map((key, slotIndex) => [key, cells[weekday][slotIndex]])),
    ]),
  )
}

/**
 * AI 에게 보낼 통계 (요일·시간대를 라벨로 풀어서 읽기 쉽게)
 * 일정은 제목 없이 개수·태그만 보낸다
 * @param {BacklogHealthStats} stats
 * @param {BacklogHealthTrend | null} trend
 */
function buildStatsForAi(stats, trend) {
  return {
    dataIsSparse: stats.dataIsSparse,
    lookbackDays: stats.lookbackDays,
    completedInPeriod: stats.completedInPeriod,
    backlog: stats.backlog,
    today: stats.today,
    throughput: stats.throughput,
    weekdaySlotCompletions: gridToLabeledObject(stats.heatmap.cells),
    focusMinutesByWeekdaySlot: stats.focus.totalMinutes > 0 ? gridToLabeledObject(stats.focus.cells) : null,
    upcomingSchedule: stats.upcomingSchedule.map((day) => ({
      date: formatShortDateLabel(day.dateString),
      count: day.count,
      tags: day.tags,
    })),
    categories: stats.categories.map((cat) => ({
      ...cat,
      bestWeekday: cat.bestWeekday === null ? null : WEEKDAY_LABELS[cat.bestWeekday],
    })),
    leadTime: stats.leadTime,
    slotAdherence: stats.slotAdherence,
    postpone: stats.postpone,
    previousCheck: trend
      ? {
          daysAgo: trend.daysSince,
          metrics: trend.previousMetrics,
          resolvedBottlenecks: `${trend.resolvedBottleneckCount}/${trend.previousBottleneckCount}`,
        }
      : null,
  }
}

/**
 * 백로그 할일을 한 줄 요약으로 변환 (막힘 점수 높은 순, ref 부여)
 * JSON 대신 한 줄 텍스트로 보내 입력 토큰을 아낀다
 * @param {Array} backlog
 * @param {number} now
 * @returns {{ lines: string[], refMap: Map<string, BacklogHealthTaskRef> }}
 */
function buildTaskLinesForAi(backlog, now) {
  const todayString = toDateString(new Date(now))
  const described = backlog
    .map((task) => describeBacklogTask(task, now, todayString))
    .sort((a, b) => b.stuckScore - a.stuckScore)
    .slice(0, BACKLOG_HEALTH_MAX_TASKS_FOR_AI)

  /** @type {Map<string, BacklogHealthTaskRef>} */
  const refMap = new Map()
  const lines = described.map((item, index) => {
    const ref = `t${index + 1}`
    const { task } = item
    refMap.set(ref, {
      id: task.id,
      title: task.title,
      category: task.category || '미분류',
      ageDays: item.ageDays,
      bounced: item.bounced,
      postponeCount: item.postponeCount,
      overdue: item.overdue,
    })

    const parts = [
      ref,
      `[${task.category || '미분류'}] ${String(task.title || '').slice(0, 60)}`,
      `${item.ageDays}일 대기`,
    ]
    if (item.postponeCount > 0) parts.push(`미룸 ${item.postponeCount}회`)
    else if (item.bounced) parts.push(`미룸(${item.daysSinceMoved}일 전 오늘 할일에 올림)`)
    if (item.overdue) parts.push(`예약일 지남(${formatShortDateLabel(task.scheduledDate)})`)
    else if (task.scheduledDate) parts.push(`예약 ${formatShortDateLabel(task.scheduledDate)}`)
    if (isValidTimeSlot(task.timeSlot)) parts.push(`시간대:${getTimeSlotInfo(task.timeSlot).label}`)
    if (task.isKey) parts.push('핵심')
    if (task.memo) parts.push(`메모: ${String(task.memo).replace(/\s+/g, ' ').slice(0, 40)}`)
    return parts.join(' | ')
  })

  return { lines, refMap }
}

/* ───────────────────────── AI 응답 정리 ───────────────────────── */

/**
 * @param {string} content
 * @returns {Object}
 */
function parseJsonContent(content) {
  const trimmed = content.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI 응답을 해석하지 못했습니다.')
    return JSON.parse(match[0])
  }
}

/**
 * @param {unknown} value
 * @param {number} [max]
 */
function cleanText(value, max = 200) {
  return String(value ?? '').trim().slice(0, max)
}

/**
 * @param {unknown} list
 * @param {number} max
 * @returns {string[]}
 */
function cleanTextList(list, max) {
  return (Array.isArray(list) ? list : [])
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, max)
}

/**
 * ref 로 할일을 가리키는 항목 목록 정리 (없는 ref·중복 제거)
 * @template T
 * @param {unknown} list
 * @param {Map<string, BacklogHealthTaskRef>} refMap
 * @param {(item: any, ref: string) => T} mapItem
 * @param {number} max
 * @returns {T[]}
 */
function cleanRefList(list, refMap, mapItem, max) {
  const seen = new Set()
  return (Array.isArray(list) ? list : [])
    .map((item) => {
      const ref = cleanText(item?.taskRef, 10)
      if (!refMap.has(ref) || seen.has(ref)) return null
      seen.add(ref)
      return mapItem(item, ref)
    })
    .filter(Boolean)
    .slice(0, max)
}

/**
 * 요일+시간대+할일 묶음 정리 (배치·묶음 공통)
 * usedRefs 에 이미 있는 할일은 빼서, 한 할일이 여러 칸에 나오지 않게 한다
 * @param {any} item
 * @param {Map<string, BacklogHealthTaskRef>} refMap
 * @param {Set<string>} usedRefs
 * @param {number} maxTasks
 * @returns {{ weekday: number, timeSlot: string, taskRefs: string[] } | null}
 */
function cleanSlotGroup(item, refMap, usedRefs, maxTasks) {
  const weekday = WEEKDAY_LABELS.indexOf(cleanText(item?.weekday, 2))
  const timeSlot = cleanText(item?.timeSlot, 20)
  if (weekday < 0 || !isValidTimeSlot(timeSlot)) return null
  const taskRefs = [...new Set((Array.isArray(item?.taskRefs) ? item.taskRefs : []).map((ref) => cleanText(ref, 10)))]
    .filter((ref) => refMap.has(ref) && !usedRefs.has(ref))
    .slice(0, maxTasks)
  if (!taskRefs.length) return null
  taskRefs.forEach((ref) => usedRefs.add(ref))
  return { weekday, timeSlot, taskRefs }
}

/**
 * AI 응답 → 화면에서 쓰는 형태 (검증·정리)
 * @param {Object} parsed
 * @param {Map<string, BacklogHealthTaskRef>} refMap
 * @param {number} now
 * @returns {BacklogHealthAiResult}
 */
function normalizeAiResult(parsed, refMap, now) {
  const bottlenecks = cleanRefList(
    parsed.bottlenecks,
    refMap,
    (item, ref) => ({
      taskRef: ref,
      type: BOTTLENECK_TYPE_LABELS[item?.type] ? item.type : 'postponed',
      reason: cleanText(item?.reason),
      action: cleanText(item?.action),
    }),
    5,
  )

  // 묶음을 먼저 정리하고, 묶음에 들어간 할일은 주간 배치에서 뺀다
  const usedInSlots = new Set()
  const batches = (Array.isArray(parsed.batches) ? parsed.batches : [])
    .map((item, index) => {
      const label = cleanText(item?.label, 30)
      if (!label) return null
      const group = cleanSlotGroup(item, refMap, usedInSlots, 5)
      if (!group || group.taskRefs.length < 2) {
        // 2개 미만이면 묶음 의미가 없으니 배치에 쓸 수 있게 되돌림
        group?.taskRefs.forEach((ref) => usedInSlots.delete(ref))
        return null
      }
      return { id: `batch-${now}-${index}`, label, ...group, reason: cleanText(item?.reason) }
    })
    .filter(Boolean)
    .slice(0, 3)

  const weeklyPlan = (Array.isArray(parsed.weeklyPlan) ? parsed.weeklyPlan : [])
    .map((item, index) => {
      const group = cleanSlotGroup(item, refMap, usedInSlots, 3)
      if (!group) return null
      return { id: `plan-${now}-${index}`, ...group, reason: cleanText(item?.reason) }
    })
    .filter(Boolean)
    .slice(0, 8)

  const rawCategory = parsed.categoryBottleneck
  const categoryBottleneck =
    rawCategory && cleanText(rawCategory.category)
      ? { category: cleanText(rawCategory.category, 40), reason: cleanText(rawCategory.reason) }
      : null

  return {
    summary: cleanText(parsed.summary, 400),
    bottlenecks,
    categoryBottleneck,
    patternInsights: cleanTextList(parsed.patternInsights, 5),
    batches,
    weeklyPlan,
    quickWins: cleanRefList(
      parsed.quickWins,
      refMap,
      (item, ref) => ({ taskRef: ref, reason: cleanText(item?.reason) }),
      5,
    ),
    cleanupCandidates: cleanRefList(
      parsed.cleanupCandidates,
      refMap,
      (item, ref) => ({ taskRef: ref, reason: cleanText(item?.reason) }),
      5,
    ),
    tips: cleanTextList(parsed.tips, 3),
  }
}

/**
 * AI 결과에서 실제로 쓰인 ref 만 남긴 할일 스냅샷 (저장 용량 절약)
 * @param {BacklogHealthAiResult} ai
 * @param {Map<string, BacklogHealthTaskRef>} refMap
 * @returns {Record<string, BacklogHealthTaskRef>}
 */
function pickUsedTaskRefs(ai, refMap) {
  const used = new Set([
    ...ai.bottlenecks.map((item) => item.taskRef),
    ...ai.batches.flatMap((item) => item.taskRefs),
    ...ai.weeklyPlan.flatMap((item) => item.taskRefs),
    ...ai.quickWins.map((item) => item.taskRef),
    ...ai.cleanupCandidates.map((item) => item.taskRef),
  ])
  return Object.fromEntries([...used].map((ref) => [ref, refMap.get(ref)]))
}

/* ───────────────────────── 마지막 결과 저장 (브라우저) ───────────────────────── */

/**
 * 마지막 점검 결과 (같은 사용자 것만)
 * @param {string | null | undefined} userId
 * @returns {BacklogHealthResult | null}
 */
export function loadLastBacklogHealthCheck(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(BACKLOG_HEALTH_LAST_RESULT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== RESULT_VERSION || parsed.userId !== userId) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * @param {BacklogHealthResult} result
 */
function saveLastBacklogHealthCheck(result) {
  try {
    localStorage.setItem(BACKLOG_HEALTH_LAST_RESULT_STORAGE_KEY, JSON.stringify(result))
  } catch {
    // 저장 실패해도 이번 결과 표시는 가능
  }
}

/* ───────────────────────── 점검 실행 ───────────────────────── */

/**
 * 백로그 점검 실행 (버튼 클릭 시에만 호출)
 * 통계는 앱에서 계산하고, AI 는 그 통계로 병목·배치·묶음·정리를 추천한다
 * @returns {Promise<{ result: BacklogHealthResult, remainingBalance: number }>}
 */
export async function runBacklogHealthCheck() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const apiKey = await getOpenAIProxyToken()
  await assertSufficientTokensForBacklogAssistant()

  const now = Date.now()
  const times = getTimeSlotTimes()
  const lookbackSince = now - BACKLOG_HEALTH_LOOKBACK_DAYS * DAY_MS
  const [backlog, completed, todayTasks, focusSessions, schedules, history] = await Promise.all([
    getBacklogTasks(),
    getCompletedTasksSince(lookbackSince),
    getTodayTasks(),
    // 보조 데이터: 실패해도 점검은 계속
    withFallback(getStudySessionsSince(lookbackSince), [], '집중 기록'),
    withFallback(getUpcomingSchedules(now), [], '일정'),
    withFallback(getBacklogHealthHistory(1), [], '지난 점검 기록'),
  ])

  if (!backlog.length) {
    throw new Error('백로그가 비어 있어서 점검할 할일이 없어요.')
  }

  const stats = buildBacklogHealthStats({ backlog, completed, todayTasks, focusSessions, schedules, now, times })
  const trend = buildTrend(history[0], backlog, now)
  const { lines, refMap } = buildTaskLinesForAi(backlog, now)

  const nowDate = new Date(now)
  const currentSlot = getTimeSlotForDate(nowDate, times)
  const userContent = [
    `오늘: ${formatShortDateLabel(toDateString(nowDate))}, 현재 시간대: ${getTimeSlotInfo(currentSlot).label}`,
    `pastSlotsToday: ${JSON.stringify(getPastTimeSlots(currentSlot, nowDate))}`,
    `시간대 시작 시각: 오전 ${formatMinutesAsTime(times.morning)}, 오후 ${formatMinutesAsTime(times.afternoon)}, 퇴근 후 ${formatMinutesAsTime(times.evening)}`,
    '',
    'stats:',
    JSON.stringify(buildStatsForAi(stats, trend)),
    '',
    `tasks (전체 ${backlog.length}개 중 막힘 점수 상위 ${lines.length}개):`,
    lines.join('\n'),
  ].join('\n')

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: BACKLOG_HEALTH_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: BACKLOG_HEALTH_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: BACKLOG_HEALTH_MAX_TOKENS,
      // 통계 근거 추천이라 창의성보다 일관성 우선
      temperature: 0.4,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || '백로그 점검에 실패했습니다.')
  }

  const data = await response.json()
  const choice = data.choices?.[0]
  if (choice?.finish_reason === 'length') {
    throw new Error('AI 응답이 길어서 중간에 끊겼어요. 다시 시도해 주세요.')
  }
  const content = choice?.message?.content
  if (!content) throw new Error('AI 응답이 비어 있습니다.')

  const ai = normalizeAiResult(parseJsonContent(content), refMap, now)
  if (!ai.summary && !ai.bottlenecks.length && !ai.weeklyPlan.length) {
    throw new Error('점검 결과를 만들지 못했어요. 다시 시도해 주세요.')
  }

  // 결과가 정상일 때만 토큰 차감
  const remainingBalance = await consumeTokensForBacklogAssistant()

  /** @type {BacklogHealthResult} */
  const result = {
    version: RESULT_VERSION,
    userId,
    checkedAt: now,
    stats,
    ai,
    taskRefs: pickUsedTaskRefs(ai, refMap),
    trend,
  }
  saveLastBacklogHealthCheck(result)
  await saveBacklogHealthRecord(userId, result)

  return { result, remainingBalance }
}

/* ───────────────────────── 추천 실행 (배치) ───────────────────────── */

/**
 * 추천 칸(요일+시간대)의 실제 날짜 계산
 * 오늘이 그 요일인데 시간대가 이미 지났으면 다음 주로 넘김 (저장된 예전 결과에도 항상 미래 날짜가 나옴)
 * @param {number} weekday - 0(일)~6(토)
 * @param {string} timeSlot
 * @param {Date} [now]
 * @returns {{ dateString: string, isToday: boolean, label: string }}
 */
export function resolvePlanDate(weekday, timeSlot, now = new Date()) {
  const todayIndex = now.getDay()
  let daysAhead = (weekday - todayIndex + 7) % 7
  if (daysAhead === 0) {
    const pastSlots = getPastTimeSlots(getTimeSlotForDate(now), now)
    if (pastSlots.includes(timeSlot)) daysAhead = 7
  }
  const target = new Date(now)
  target.setDate(target.getDate() + daysAhead)
  const dateString = toDateString(target)
  const slotLabel = getTimeSlotInfo(timeSlot).label
  return {
    dateString,
    isToday: daysAhead === 0,
    label: daysAhead === 0 ? `오늘 ${slotLabel}` : `${formatShortDateLabel(dateString)} ${slotLabel}`,
  }
}

/**
 * 백로그 할일을 추천 칸에 배치
 * - 오늘이면 바로 오늘 할일(해당 시간대)로 이동
 * - 이후 날짜면 예약일 + 시간대 지정 (그날 자동으로 오늘 할일로 옮겨짐)
 * @param {string} taskId
 * @param {number} weekday
 * @param {string} timeSlot
 * @returns {Promise<string>} 배치된 칸 라벨
 */
export async function scheduleBacklogTaskToSlot(taskId, weekday, timeSlot) {
  const { dateString, isToday, label } = resolvePlanDate(weekday, timeSlot)
  if (isToday) {
    await moveToToday(taskId, { timeSlot })
  } else {
    await updateTask(taskId, { scheduledDate: dateString, timeSlot })
  }
  return label
}
