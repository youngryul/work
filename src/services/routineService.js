import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { getDefaultCategory } from './categoryService.js'
import { createTask } from './taskService.js'

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
 * @param {{ title: string, category?: string, isEnabled?: boolean }} payload
 */
export async function createDailyRoutine(payload) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const title = (payload.title || '').trim()
  if (!title) throw new Error('루틴 제목을 입력해주세요.')

  const category = payload.category || (await getDefaultCategory())

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
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('루틴 생성 오류:', error)
    throw error
  }

  const routine = normalizeRoutine(data)

  if (routine.isEnabled) {
    const today = getTodayDateString()
    try {
      const created = await claimAndCreateRoutineTask(userId, routine, today)
      if (created) {
        routine.lastAppliedDate = today
        window.dispatchEvent?.(new CustomEvent('refreshTodayTasks'))
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
 * @param {{ title?: string, category?: string, isEnabled?: boolean }} updates
 */
export async function updateDailyRoutine(id, updates) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const dbUpdates = {}
  if ('title' in updates) dbUpdates.title = (updates.title || '').trim()
  if ('category' in updates) dbUpdates.category = updates.category
  if ('isEnabled' in updates) dbUpdates.is_enabled = updates.isEnabled

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
 * 오늘 미반영 루틴을 선점(claim)한 뒤 할일 생성.
 * last_applied_date를 먼저 갱신해 동시 호출·다중 탭에서도 하루 1회만 생성.
 * @param {string} userId
 * @param {{ id: string, title: string, category: string, lastAppliedDate?: string | null }} routine
 * @param {string} today YYYY-MM-DD
 * @returns {Promise<boolean>} 이번 호출에서 할일을 만들었으면 true
 */
async function claimAndCreateRoutineTask(userId, routine, today) {
  const previousDate = routine.lastAppliedDate ?? null

  // NULL이거나 오늘이 아닌 행만 갱신 → 선점 성공 시에만 select 반환
  const { data: claimed, error: claimError } = await supabase
    .from('daily_routines')
    .update({ last_applied_date: today })
    .eq('id', routine.id)
    .eq('user_id', userId)
    .or(`last_applied_date.is.null,last_applied_date.neq.${today}`)
    .select('id')

  if (claimError) {
    console.error('루틴 선점 오류:', claimError)
    return false
  }
  if (!claimed || claimed.length === 0) {
    return false
  }

  try {
    await createTask(
      buildRoutineTodayTaskTitle(routine.title, today),
      routine.category,
      true,
    )
    return true
  } catch (error) {
    console.error('루틴 할일 생성 오류:', routine.id, error)
    // 생성 실패 시 선점 되돌리기 (같은 날 재시도 가능)
    await supabase
      .from('daily_routines')
      .update({ last_applied_date: previousDate })
      .eq('id', routine.id)
      .eq('user_id', userId)
      .eq('last_applied_date', today)
    return false
  }
}

/**
 * 활성 루틴을 오늘 할일로 반영 (하루 1회)
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

    const pending = routines.filter(
      (routine) => routine.isEnabled && routine.lastAppliedDate !== today,
    )
    if (pending.length === 0) return 0

    let createdCount = 0
    for (const routine of pending) {
      const created = await claimAndCreateRoutineTask(userId, routine, today)
      if (created) createdCount += 1
    }

    return createdCount
  })().finally(() => {
    applyDailyRoutinesInFlight = null
  })

  return applyDailyRoutinesInFlight
}
