import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { getDefaultCategory } from './categoryService.js'
import { createTask } from './taskService.js'

/** 요일 라벨 (0=일..6=토) */
export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * DB CSV → 정렬된 요일 배열 (빈 배열 = 매일)
 * @param {string | null | undefined} csv
 * @returns {number[]}
 */
function parseWeekdays(csv) {
  if (!csv) return []
  const days = String(csv)
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  return [...new Set(days)].sort((a, b) => a - b)
}

/**
 * 요일 배열 → DB CSV (빈 배열·7일 전체는 NULL = 매일)
 * @param {number[] | null | undefined} days
 * @returns {string | null}
 */
function serializeWeekdays(days) {
  const normalized = parseWeekdays((days || []).join(','))
  if (normalized.length === 0 || normalized.length === 7) return null
  return normalized.join(',')
}

/**
 * 해당 날짜에 루틴이 반복되는지 여부
 * @param {{ repeatWeekdays?: number[] }} routine
 * @param {string} [ymd] YYYY-MM-DD
 * @returns {boolean}
 */
export function isRoutineScheduledOn(routine, ymd = getTodayDateString()) {
  const days = routine?.repeatWeekdays || []
  if (days.length === 0) return true
  const weekday = new Date(`${ymd}T00:00:00`).getDay()
  return days.includes(weekday)
}

/**
 * 반복 요일 표시 문자열
 * @param {number[]} days
 * @returns {string}
 */
export function formatRoutineWeekdays(days) {
  if (!days || days.length === 0) return '매일'
  return days.map((d) => WEEKDAY_LABELS[d]).join('·')
}

/**
 * @param {object} row
 */
function normalizeRoutine(row) {
  if (!row) return row
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    isEnabled: row.is_enabled ?? row.isEnabled ?? true,
    lastAppliedDate: row.last_applied_date ?? row.lastAppliedDate ?? null,
    createdAt: row.created_at ?? row.createdAt,
    sortOrder: row.sort_order ?? row.sortOrder ?? 0,
    repeatWeekdays: parseWeekdays(row.repeat_weekdays),
  }
}

/**
 * @returns {string} YYYY-MM-DD (로컬)
 */
export function getTodayDateString() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 루틴 → 오늘 할일 제목 (오늘 날짜 포함)
 * @param {string} routineTitle
 * @param {string} [todayYmd] YYYY-MM-DD
 * @returns {string}
 */
export function buildRoutineTodayTaskTitle(routineTitle, todayYmd = getTodayDateString()) {
  const base = (routineTitle || '').trim()
  if (!base) return ''

  const formatted = new Date(`${todayYmd}T00:00:00`).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  return `${formatted} ${base}`
}

/**
 * 사용자 루틴 목록 조회
 * @returns {Promise<Array>}
 */
export async function getDailyRoutines() {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('daily_routines')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('루틴 조회 오류:', error)
    throw error
  }

  return (data || []).map(normalizeRoutine)
}

/**
 * 루틴 추가
 * @param {{ title: string, category?: string, isEnabled?: boolean, repeatWeekdays?: number[] }} payload
 */
export async function createDailyRoutine(payload) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const title = (payload.title || '').trim()
  if (!title) throw new Error('루틴 제목을 입력해주세요.')

  const category = payload.category || (await getDefaultCategory())
  const repeatWeekdays = serializeWeekdays(payload.repeatWeekdays)

  const { data: existing } = await supabase
    .from('daily_routines')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSort =
    existing && existing.length > 0 ? (existing[0].sort_order ?? 0) + 1 : 0

  const { data, error } = await supabase
    .from('daily_routines')
    .insert([
      {
        user_id: userId,
        title,
        category,
        is_enabled: payload.isEnabled !== false,
        created_at: Date.now(),
        sort_order: nextSort,
        // 매일(NULL)이면 컬럼을 보내지 않아 마이그레이션 전 DB에서도 동작
        ...(repeatWeekdays ? { repeat_weekdays: repeatWeekdays } : {}),
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('루틴 생성 오류:', error)
    throw error
  }

  const routine = normalizeRoutine(data)

  const today = getTodayDateString()
  if (routine.isEnabled && isRoutineScheduledOn(routine, today)) {
    try {
      const created = await ensureRoutineTaskForToday(userId, routine, today)
      if (created) {
        routine.lastAppliedDate = today
        window.dispatchEvent(new CustomEvent('refreshTodayTasks'))
      }
    } catch (applyError) {
      console.error('루틴 오늘 할일 즉시 반영 오류:', applyError)
    }
  }

  return routine
}

/**
 * 루틴 수정
 * @param {string} id
 * @param {{ title?: string, category?: string, isEnabled?: boolean, repeatWeekdays?: number[] }} updates
 */
export async function updateDailyRoutine(id, updates) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const dbUpdates = {}
  if ('title' in updates) dbUpdates.title = (updates.title || '').trim()
  if ('category' in updates) dbUpdates.category = updates.category
  if ('isEnabled' in updates) dbUpdates.is_enabled = updates.isEnabled
  if ('repeatWeekdays' in updates) {
    dbUpdates.repeat_weekdays = serializeWeekdays(updates.repeatWeekdays)
  }

  const { data, error } = await supabase
    .from('daily_routines')
    .update(dbUpdates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('루틴 수정 오류:', error)
    throw error
  }

  return normalizeRoutine(data)
}

/**
 * 루틴 삭제
 * @param {string} id
 */
export async function deleteDailyRoutine(id) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('daily_routines')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('루틴 삭제 오류:', error)
    throw error
  }
}

/** 동일 탭에서 App + TodayView 동시 호출로 중복 생성되는 것을 막음 */
let applyDailyRoutinesInFlight = null

/**
 * 오늘 날짜 제목의 할일이 오늘/백로그 어디에든 있는지 확인
 * @param {string} userId
 * @param {string} title
 * @returns {Promise<boolean>}
 */
async function hasTaskWithTitleAnywhere(userId, title) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('title', title)
    .limit(1)

  if (error) {
    console.error('루틴 할일 중복 확인 오류:', error)
    return false
  }
  return (data || []).length > 0
}

/**
 * 루틴 1건 → 오늘 할일 1개 (하루 1회)
 * last_applied_date가 오늘이면 백로그로 옮겨도 재생성하지 않음
 * @param {string} userId
 * @param {{ id: string, title: string, category: string, lastAppliedDate?: string | null }} routine
 * @param {string} today YYYY-MM-DD
 * @returns {Promise<boolean>} 이번 호출에서 할일을 새로 만들었으면 true
 */
async function ensureRoutineTaskForToday(userId, routine, today) {
  const title = buildRoutineTodayTaskTitle(routine.title, today)
  if (!title) return false

  // DB 플래그: 오늘 이미 생성된 루틴은 다시 만들지 않음
  if (routine.lastAppliedDate === today) {
    return false
  }

  // 플래그가 비었더라도 같은 제목 할일이 있으면(오늘·백로그) 재생성하지 않고 플래그만 맞춤
  const alreadyExists = await hasTaskWithTitleAnywhere(userId, title)
  if (alreadyExists) {
    await supabase
      .from('daily_routines')
      .update({ last_applied_date: today })
      .eq('id', routine.id)
      .eq('user_id', userId)
    return false
  }

  await createTask(title, routine.category, true)

  const { error } = await supabase
    .from('daily_routines')
    .update({ last_applied_date: today })
    .eq('id', routine.id)
    .eq('user_id', userId)

  if (error) {
    console.error('루틴 last_applied_date 갱신 오류:', error)
  }
  return true
}

/**
 * 활성 루틴을 오늘 할일로 반영 (루틴당 하루 1개)
 * @returns {Promise<number>} 오늘 새로 추가된 할 일 개수
 */
export async function applyDailyRoutinesToToday() {
  if (applyDailyRoutinesInFlight) {
    return applyDailyRoutinesInFlight
  }

  applyDailyRoutinesInFlight = (async () => {
    const userId = await getCurrentUserId()
    if (!userId) return 0

    const today = getTodayDateString()
    let routines
    try {
      routines = await getDailyRoutines()
    } catch (error) {
      console.error('루틴 적용: 목록 조회 실패', error)
      return 0
    }

    // 활성 + 오늘 요일에 해당하는 루틴만 반영
    const enabled = routines.filter(
      (routine) => routine.isEnabled && isRoutineScheduledOn(routine, today),
    )
    if (enabled.length === 0) return 0

    let createdCount = 0
    for (const routine of enabled) {
      try {
        const created = await ensureRoutineTaskForToday(userId, routine, today)
        if (created) createdCount += 1
      } catch (error) {
        console.error('루틴 할일 생성 오류:', routine.id, error)
      }
    }

    return createdCount
  })().finally(() => {
    applyDailyRoutinesInFlight = null
  })

  return applyDailyRoutinesInFlight
}
