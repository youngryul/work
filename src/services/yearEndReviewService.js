import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { STUDY_TIMER_CATEGORIES, normalizeStudyCategory } from '../constants/studyTimerCategories.js'

/** Supabase 기본 응답 한도(1000행)에 맞춘 페이지 크기 */
const PAGE_SIZE = 1000

/** 연말정산 팝업 노출 기간: 12월 15일 ~ 다음 해 1월 15일 */
const SHOW_FROM_DECEMBER_DAY = 15
const SHOW_UNTIL_JANUARY_DAY = 15

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 지금이 연말정산 팝업 노출 기간이면 대상 연도를, 아니면 null을 반환
 * (1월에는 지난 해가 대상)
 * @param {Date} [now]
 * @returns {number|null}
 */
export function getYearEndReviewTargetYear(now = new Date()) {
  const month = now.getMonth() + 1
  const day = now.getDate()
  if (month === 12 && day >= SHOW_FROM_DECEMBER_DAY) return now.getFullYear()
  if (month === 1 && day <= SHOW_UNTIL_JANUARY_DAY) return now.getFullYear() - 1
  return null
}

/**
 * 연말정산 팝업의 "봤음" 기록 키 (monthly_stats_popups.period_month 재사용)
 * @param {number} year
 * @returns {string}
 */
export function getYearEndReviewSeenKey(year) {
  return `${year}-YEAR`
}

/**
 * 1000행 제한을 넘는 결과를 페이지 단위로 모두 조회
 * @param {() => object} buildQuery - 매 페이지마다 새 쿼리 빌더를 만드는 함수
 * @returns {Promise<object[]>}
 */
async function fetchAllRows(buildQuery) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().order('id').range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

/** Date → 'YYYY-MM-DD' (로컬) */
function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' → 월 인덱스(0~11) */
function monthIndexOf(dateKey) {
  return Number(dateKey.slice(5, 7)) - 1
}

/** 값이 가장 큰 항목의 [key, value] (비어 있으면 null) */
function maxEntry(record) {
  let best = null
  for (const [key, value] of Object.entries(record)) {
    if (!best || value > best[1]) best = [key, value]
  }
  return best
}

/** 12칸 배열에서 값이 가장 큰 달 → { month: 1~12, value } (모두 0이면 null) */
function bestMonthOf(monthly) {
  const max = Math.max(...monthly)
  if (max <= 0) return null
  return { month: monthly.indexOf(max) + 1, value: max }
}

/** jsonb 배열 또는 JSON 문자열을 배열로 */
function toArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

/** 날짜 키 집합에서 가장 긴 연속 일수 */
function longestStreakOf(dateKeys) {
  const sorted = [...dateKeys].sort()
  let longest = 0
  let current = 0
  let prevTime = null
  for (const key of sorted) {
    const [y, m, d] = key.split('-').map(Number)
    const time = new Date(y, m - 1, d).getTime()
    // 서머타임 등으로 하루가 정확히 24시간이 아닐 수 있어 반올림으로 비교
    current = prevTime !== null && Math.round((time - prevTime) / DAY_MS) === 1 ? current + 1 : 1
    if (current > longest) longest = current
    prevTime = time
  }
  return longest
}

/**
 * 할 일 집계
 * @param {string} userId
 * @param {number} year
 */
async function buildTaskStats(userId, year) {
  const startMs = new Date(year, 0, 1).getTime()
  const endMs = new Date(year + 1, 0, 1).getTime()

  const [completedRows, createdResult, createdDoneResult, categoryEmojiMap] = await Promise.all([
    fetchAllRows(() =>
      supabase
        .from('tasks')
        .select('id, title, category, createdat, completedat')
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('completedat', startMs)
        .lt('completedat', endMs),
    ),
    // 완료율 계산용: 올해 만든 할 일 수 / 그중 완료한 수 (행은 받지 않고 개수만)
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('createdat', startMs)
      .lt('createdat', endMs),
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('createdat', startMs)
      .lt('createdat', endMs),
    // getCategories()는 카테고리가 없으면 기본값을 생성하는 부수효과가 있어 직접 조회
    supabase
      .from('categories')
      .select('name, emoji')
      .eq('user_id', userId)
      .then(({ data }) => Object.fromEntries((data || []).map((c) => [c.name, c.emoji]))),
  ])

  const monthly = Array(12).fill(0)
  const byCategory = {}
  const byWeekday = Array(7).fill(0)
  const byDate = {}
  let longestWait = null

  for (const task of completedRows) {
    const completedAt = new Date(Number(task.completedat))
    const dateKey = toDateKey(completedAt)
    monthly[completedAt.getMonth()] += 1
    byWeekday[completedAt.getDay()] += 1
    byDate[dateKey] = (byDate[dateKey] || 0) + 1
    const category = task.category || '기타'
    byCategory[category] = (byCategory[category] || 0) + 1

    const waitDays = Math.floor((Number(task.completedat) - Number(task.createdat)) / DAY_MS)
    if (Number.isFinite(waitDays) && (!longestWait || waitDays > longestWait.days)) {
      longestWait = { title: task.title, days: waitDays }
    }
  }

  const createdCount = createdResult.count || 0
  const createdDoneCount = createdDoneResult.count || 0
  const bestDay = maxEntry(byDate)
  const bestWeekdayCount = Math.max(...byWeekday)

  return {
    total: completedRows.length,
    completionRate: createdCount > 0 ? Math.round((createdDoneCount / createdCount) * 100) : null,
    topCategories: Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count, emoji: categoryEmojiMap[name] || '📌' })),
    monthly,
    bestMonth: bestMonthOf(monthly),
    bestWeekday: bestWeekdayCount > 0 ? WEEKDAY_LABELS[byWeekday.indexOf(bestWeekdayCount)] : null,
    bestDay: bestDay ? { date: bestDay[0], count: bestDay[1] } : null,
    // 7일 이상 묵힌 것만 "오래 묵힌 할 일"로 소개
    longestWait: longestWait && longestWait.days >= 7 ? longestWait : null,
    dateKeys: Object.keys(byDate),
  }
}

/**
 * 집중 시간대 유형 (세션 기록 시각 기준)
 * @param {number[]} secondsByHour - 24칸
 */
function resolveFocusTimeType(secondsByHour) {
  const sum = (from, to) => secondsByHour.slice(from, to).reduce((a, b) => a + b, 0)
  const buckets = [
    { label: '아침형', emoji: '🌅', description: '오전에 가장 많이 집중했어요', seconds: sum(5, 12) },
    { label: '오후형', emoji: '☀️', description: '오후에 가장 많이 집중했어요', seconds: sum(12, 18) },
    { label: '저녁형', emoji: '🌆', description: '저녁에 가장 많이 집중했어요', seconds: sum(18, 23) },
    { label: '올빼미형', emoji: '🦉', description: '늦은 밤에 가장 많이 집중했어요', seconds: sum(23, 24) + sum(0, 5) },
  ]
  const best = buckets.reduce((a, b) => (b.seconds > a.seconds ? b : a))
  return best.seconds > 0 ? { label: best.label, emoji: best.emoji, description: best.description } : null
}

/**
 * 타이머(공부·뽀모도로) 집계
 * @param {string} userId
 * @param {number} year
 */
async function buildTimeStats(userId, year) {
  const rows = await fetchAllRows(() =>
    supabase
      .from('study_sessions')
      .select('id, study_date, duration_seconds, category, created_at')
      .eq('user_id', userId)
      .gte('study_date', `${year}-01-01`)
      .lte('study_date', `${year}-12-31`),
  )

  const monthly = Array(12).fill(0)
  const byCategory = {}
  const byDate = {}
  const secondsByHour = Array(24).fill(0)
  let totalSeconds = 0

  for (const row of rows) {
    const seconds = Number(row.duration_seconds) || 0
    if (seconds <= 0 || !row.study_date) continue
    totalSeconds += seconds
    monthly[monthIndexOf(row.study_date)] += seconds
    byDate[row.study_date] = (byDate[row.study_date] || 0) + seconds
    const category = normalizeStudyCategory(row.category)
    byCategory[category] = (byCategory[category] || 0) + seconds

    if (row.created_at) {
      const hour = new Date(row.created_at).getHours()
      if (Number.isFinite(hour)) secondsByHour[hour] += seconds
    }
  }

  const bestDay = maxEntry(byDate)

  return {
    totalSeconds,
    focusDays: Object.keys(byDate).length,
    categories: STUDY_TIMER_CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      emoji: c.emoji,
      seconds: byCategory[c.id] || 0,
      percent: totalSeconds > 0 ? Math.round(((byCategory[c.id] || 0) / totalSeconds) * 100) : 0,
    }))
      .filter((c) => c.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds),
    monthly,
    bestMonth: bestMonthOf(monthly),
    bestDay: bestDay ? { date: bestDay[0], seconds: bestDay[1] } : null,
    timeType: resolveFocusTimeType(secondsByHour),
    dateKeys: Object.keys(byDate),
  }
}

/** 일기 본문에서 첫 문장만 추출 (마크다운 기호 제거, 길면 말줄임) */
function extractFirstSentence(content) {
  const firstLine = String(content || '')
    .split('\n')
    .map((line) => line.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/[#>*_`~-]/g, '').trim())
    .find((line) => line.length > 0)
  if (!firstLine) return null
  const sentence = firstLine.split(/(?<=[.!?。])\s/)[0]
  return sentence.length > 70 ? `${sentence.slice(0, 70)}…` : sentence
}

/** 일기 행에서 대표 이미지 URL */
function diaryThumbOf(row) {
  return (
    row.cover_image_url ||
    row.image_url ||
    toArray(row.four_cut_scene_urls)[0] ||
    row.four_cut_url ||
    toArray(row.attached_images)[0] ||
    null
  )
}

/** 배열에서 최대 count개를 고르게 뽑기 (1년 전체에 걸쳐 분포) */
function pickEvenly(items, count) {
  if (items.length <= count) return items
  const step = items.length / count
  return Array.from({ length: count }, (_, i) => items[Math.floor(i * step)])
}

/**
 * 일기 집계
 * @param {string} userId
 * @param {number} year
 */
async function buildDiaryStats(userId, year) {
  const rows = await fetchAllRows(() =>
    supabase
      .from('diaries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`),
  )
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)))

  const monthly = Array(12).fill(0)
  const byEmotion = {}
  const withImage = []

  for (const row of rows) {
    monthly[monthIndexOf(row.date)] += 1
    const emotion = typeof row.emotion === 'string' ? row.emotion.trim() : ''
    if (emotion) byEmotion[emotion] = (byEmotion[emotion] || 0) + 1
    const thumb = diaryThumbOf(row)
    if (thumb) withImage.push({ date: row.date, url: thumb })
  }

  const first = rows.find((row) => extractFirstSentence(row.content))

  return {
    count: rows.length,
    monthly,
    bestMonth: bestMonthOf(monthly),
    topEmotions: Object.entries(byEmotion)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count })),
    gallery: pickEvenly(withImage, 6),
    first: first ? { date: first.date, sentence: extractFirstSentence(first.content) } : null,
    dateKeys: rows.map((row) => row.date),
  }
}

/**
 * 올해의 유형 한 줄 요약
 * - 가장 두드러진 활동(할 일·집중·일기)과 꾸준함/시간대를 조합
 */
function resolveYearType({ tasks, time, diary, longestStreak }) {
  // 서로 단위가 달라 "1년에 이 정도면 충분히 많이 했다"는 기준값으로 나눠 비교
  const scores = [
    { key: 'tasks', score: tasks.total / 300, title: '실행가', emoji: '✅', line: '해야 할 일을 차근차근 해낸 한 해였어요' },
    { key: 'time', score: time.totalSeconds / 3600 / 150, title: '몰입가', emoji: '⏱️', line: '집중하는 시간을 꾸준히 쌓은 한 해였어요' },
    { key: 'diary', score: diary.count / 120, title: '기록가', emoji: '📔', line: '하루하루를 글로 남긴 한 해였어요' },
  ]
  const main = scores.reduce((a, b) => (b.score > a.score ? b : a))
  const prefix = longestStreak >= 30 ? '꾸준한' : time.timeType ? time.timeType.label : '성실한'
  return { title: `${prefix} ${main.title}`, emoji: main.emoji, line: main.line }
}

/**
 * 연말정산 통계 조회
 * @param {number} year
 * @param {string} [userId]
 * @returns {Promise<object|null>} 로그인 전이면 null
 */
export async function fetchYearEndReviewStats(year, userId = null) {
  if (!userId) userId = await getCurrentUserId()
  if (!userId) return null

  const [tasks, time, diary] = await Promise.all([
    buildTaskStats(userId, year),
    buildTimeStats(userId, year),
    buildDiaryStats(userId, year),
  ])

  // "기록한 날" = 할 일 완료·타이머·일기 중 하나라도 있는 날
  const activeDates = new Set([...tasks.dateKeys, ...time.dateKeys, ...diary.dateKeys])
  const longestStreak = longestStreakOf(activeDates)

  return {
    year,
    activeDays: activeDates.size,
    longestStreak,
    tasks,
    time,
    diary,
    yearType: resolveYearType({ tasks, time, diary, longestStreak }),
  }
}
