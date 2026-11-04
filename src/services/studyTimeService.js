import { supabase } from '../config/supabase.js'
import {
  addStudySecondsToCategoryTotals,
  emptyStudyCategoryTotals,
  normalizeStudyCategory,
  DEFAULT_STUDY_TIMER_CATEGORY,
} from '../constants/studyTimerCategories.js'
import { awardJellyForStudySession } from './jellyService.js'

/**
 * 오늘 날짜 YYYY-MM-DD (로컬)
 * @returns {string}
 */
export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 초 → "1시간 20분" / "25분" / "40초"
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatStudyDuration(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  if (sec < 60) return `${sec}초`
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`
  if (hours > 0) return `${hours}시간`
  return `${minutes}분`
}

/**
 * 달력용 짧은 표기 (예: 1h20m, 25m)
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatStudyDurationShort(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  if (sec <= 0) return ''
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  if (hours > 0 && minutes > 0) return `${hours}h${minutes}m`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}분`
  return `${sec}초`
}

/**
 * 공부 세션 추가 (+ 10분당 젤리 1, 세션 ID로 웹/앱 중복 방지)
 * @param {number} durationSeconds
 * @param {{ studyDate?: string, source?: string, category?: string, taskId?: string | null, taskTitle?: string | null }} [options]
 * @returns {Promise<object & { jellyAwarded: number }>}
 */
export async function addStudySession(durationSeconds, options = {}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const seconds = Math.floor(Number(durationSeconds) || 0)
  if (seconds <= 0) throw new Error('기록할 공부 시간이 없습니다.')

  const studyDate = options.studyDate || getLocalDateString()
  const source = options.source || 'summer-clock'
  const category = normalizeStudyCategory(
    options.category || DEFAULT_STUDY_TIMER_CATEGORY,
  )

  const { data, error } = await supabase
    .from('study_sessions')
    .insert({
      user_id: user.id,
      study_date: studyDate,
      duration_seconds: seconds,
      source,
      category,
      // 할 일과 연결된 뽀모도로일 때만 보내 마이그레이션 전 DB에서도 동작
      ...(options.taskId ? { task_id: options.taskId, task_title: options.taskTitle || null } : {}),
    })
    .select('*')
    .single()

  if (error) throw error

  let jellyAwarded = 0
  try {
    const jellyResult = await awardJellyForStudySession(data.id, seconds)
    jellyAwarded = jellyResult?.awarded ?? 0
  } catch (jellyError) {
    console.error('타이머 젤리 지급 실패:', jellyError)
  }

  return { ...data, jellyAwarded }
}

/** 뽀모도로 타이머 세션 source 값 */
export const POMODORO_SOURCE = 'pomodoro'

/**
 * 조회 쿼리에 제외할 source 조건 적용
 * @param {object} query - supabase 쿼리 빌더
 * @param {string[]} [excludeSources]
 */
function applyExcludeSources(query, excludeSources) {
  if (!excludeSources || excludeSources.length === 0) return query
  return query.not('source', 'in', `(${excludeSources.join(',')})`)
}

/**
 * 월별 날짜 → 총 공부 초
 * @param {number} year
 * @param {number} month - 1~12
 * @param {{ excludeSources?: string[] }} [options] - 제외할 source (예: 할 일 달력에서 뽀모도로 제외)
 * @returns {Promise<Record<string, number>>}
 */
export async function getStudySecondsByDate(year, month, options = {}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return {}

  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await applyExcludeSources(
    supabase
      .from('study_sessions')
      .select('study_date, duration_seconds')
      .eq('user_id', user.id)
      .gte('study_date', start)
      .lte('study_date', end),
    options.excludeSources,
  )

  if (error) throw error

  /** @type {Record<string, number>} */
  const totals = {}
  for (const row of data || []) {
    const key = row.study_date
    totals[key] = (totals[key] || 0) + (Number(row.duration_seconds) || 0)
  }
  return totals
}

/**
 * 최근 N개월 날짜 → 총 공부 초 (일자별 통계용)
 * @param {number} months - 최근 몇 개월 (기본 6)
 * @returns {Promise<Array<{date: string, seconds: number, sources: Record<string,number>, categories: Record<string,number>}>>}
 */
export async function getStudySessionsByRange(months = 6) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const startStr = getLocalDateString(start)
  const endStr = getLocalDateString(now)

  const { data, error } = await supabase
    .from('study_sessions')
    .select('study_date, duration_seconds, source, category')
    .eq('user_id', user.id)
    .gte('study_date', startStr)
    .lte('study_date', endStr)
    .order('study_date', { ascending: false })

  if (error) throw error

  /** @type {Record<string, {seconds: number, sources: Record<string,number>, categories: Record<string,number>}>} */
  const map = {}
  for (const row of data || []) {
    const key = row.study_date
    if (!map[key]) {
      map[key] = {
        seconds: 0,
        sources: {},
        categories: emptyStudyCategoryTotals(),
      }
    }
    const secs = Number(row.duration_seconds) || 0
    map[key].seconds += secs
    const src = row.source || 'unknown'
    map[key].sources[src] = (map[key].sources[src] || 0) + secs
    addStudySecondsToCategoryTotals(map[key].categories, row.category, secs)
  }

  return Object.entries(map)
    .map(([date, val]) => ({ date, ...val }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * 특정 날짜 총 타이머 초
 * @param {string} dateString - YYYY-MM-DD
 * @returns {Promise<number>}
 */
export async function getStudySecondsForDate(dateString) {
  const breakdown = await getStudyBreakdownForDate(dateString)
  return breakdown.totalSeconds
}

/**
 * 특정 날짜 총·카테고리별 타이머 초
 * @param {string} dateString - YYYY-MM-DD
 * @param {{ excludeSources?: string[] }} [options] - 제외할 source
 * @returns {Promise<{ totalSeconds: number, byCategory: Record<string, number> }>}
 */
export async function getStudyBreakdownForDate(dateString, options = {}) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { totalSeconds: 0, byCategory: emptyStudyCategoryTotals() }
  }

  const { data, error } = await applyExcludeSources(
    supabase
      .from('study_sessions')
      .select('duration_seconds, category')
      .eq('user_id', user.id)
      .eq('study_date', dateString),
    options.excludeSources,
  )

  if (error) throw error

  const byCategory = emptyStudyCategoryTotals()
  let totalSeconds = 0
  for (const row of data || []) {
    const secs = Number(row.duration_seconds) || 0
    totalSeconds += secs
    addStudySecondsToCategoryTotals(byCategory, row.category, secs)
  }
  return { totalSeconds, byCategory }
}

/**
 * 이번 주 월요일 YYYY-MM-DD (로컬)
 * @param {Date} [date]
 * @returns {string}
 */
function getMondayDateString(date = new Date()) {
  const monday = new Date(date)
  const diff = (monday.getDay() + 6) % 7 // 월=0 … 일=6
  monday.setDate(monday.getDate() - diff)
  return getLocalDateString(monday)
}

/**
 * 뽀모도로 합계 (할 일 달력과 별도로 보는 용도)
 * @returns {Promise<{
 *   today: { seconds: number, count: number },
 *   week: { seconds: number, count: number },
 *   month: { seconds: number, count: number },
 *   all: { seconds: number, count: number },
 *   recentDays: Array<{ date: string, seconds: number }>,
 *   topTasks: Array<{ title: string, seconds: number, count: number }>,
 * }>}
 */
export async function getPomodoroSummary() {
  const empty = () => ({ seconds: 0, count: 0 })
  const summary = {
    today: empty(),
    week: empty(),
    month: empty(),
    all: empty(),
    recentDays: [],
    topTasks: [],
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return summary

  // select('*'): task_id·task_title 컬럼이 아직 없는 DB에서도 오류 없이 동작
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('source', POMODORO_SOURCE)

  if (error) throw error

  const now = new Date()
  const todayStr = getLocalDateString(now)
  const weekStartStr = getMondayDateString(now)
  const monthPrefix = todayStr.slice(0, 7)

  // 최근 7일 (오래된 날 → 오늘)
  /** @type {Record<string, number>} */
  const recentMap = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    recentMap[getLocalDateString(d)] = 0
  }

  /** @type {Record<string, { title: string, seconds: number, count: number }>} */
  const taskMap = {}

  const add = (bucket, secs) => {
    bucket.seconds += secs
    bucket.count += 1
  }

  for (const row of data || []) {
    const secs = Number(row.duration_seconds) || 0
    const date = row.study_date
    add(summary.all, secs)
    if (date === todayStr) add(summary.today, secs)
    if (date >= weekStartStr && date <= todayStr) add(summary.week, secs)
    if (date.startsWith(monthPrefix)) {
      add(summary.month, secs)
      // 이번 달 할 일별 합계 (연결된 할 일이 없으면 "할 일 미지정")
      const key = row.task_id || row.task_title || '__none__'
      if (!taskMap[key]) {
        taskMap[key] = { title: row.task_title || '할 일 미지정', seconds: 0, count: 0 }
      }
      taskMap[key].seconds += secs
      taskMap[key].count += 1
    }
    if (date in recentMap) recentMap[date] += secs
  }

  summary.recentDays = Object.entries(recentMap).map(([date, seconds]) => ({ date, seconds }))
  summary.topTasks = Object.values(taskMap)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5)

  return summary
}
