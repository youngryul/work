import { supabase } from '../config/supabase.js'
import {
  addStudySecondsToCategoryTotals,
  emptyStudyCategoryTotals,
  normalizeStudyCategory,
  DEFAULT_STUDY_TIMER_CATEGORY,
} from '../constants/studyTimerCategories.js'

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
 * 공부 세션 추가
 * @param {number} durationSeconds
 * @param {{ studyDate?: string, source?: string, category?: string }} [options]
 * @returns {Promise<object>}
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
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

/**
 * 월별 날짜 → 총 공부 초
 * @param {number} year
 * @param {number} month - 1~12
 * @returns {Promise<Record<string, number>>}
 */
export async function getStudySecondsByDate(year, month) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return {}

  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('study_sessions')
    .select('study_date, duration_seconds')
    .eq('user_id', user.id)
    .gte('study_date', start)
    .lte('study_date', end)

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
 * @returns {Promise<{ totalSeconds: number, byCategory: Record<string, number> }>}
 */
export async function getStudyBreakdownForDate(dateString) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { totalSeconds: 0, byCategory: emptyStudyCategoryTotals() }
  }

  const { data, error } = await supabase
    .from('study_sessions')
    .select('duration_seconds, category')
    .eq('user_id', user.id)
    .eq('study_date', dateString)

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
