import { supabase } from '../config/supabase.js'
import { getDefaultCategory } from './categoryService.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 데이터베이스 컬럼명을 camelCase로 변환
 * @param {Object} task - 데이터베이스에서 가져온 할 일 객체
 * @returns {Object} 변환된 할 일 객체
 */
function normalizeTask(task) {
  if (!task) return task
  return {
    ...task,
    isToday: task.istoday ?? task.isToday,
    createdAt: task.createdat ?? task.createdAt,
    completedAt: task.completedat ?? task.completedAt,
    movedToTodayAt: task.movedtotodayat ?? task.movedToTodayAt,
    memo: task.memo ?? null,
    images: task.images ?? [],
  }
}

/**
 * 모든 할 일 조회
 * @returns {Promise<Array>} 할 일 목록
 */
export async function getAllTasks() {
  const userId = await getCurrentUserId()
  if (!userId) {
    console.warn('로그인이 필요합니다.')
    return []
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('createdat', { ascending: false })

  if (error) {
    console.error('할 일 조회 오류:', error)
    return []
  }

  return (data || []).map(normalizeTask)
}

/**
 * 오늘 할 일 조회
 * @returns {Promise<Array>} 오늘 할 일 목록
 */
export async function getTodayTasks() {
  const userId = await getCurrentUserId()
  if (!userId) {
    console.warn('로그인이 필요합니다.')
    return []
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('istoday', true)
    .order('movedtotodayat', { ascending: true, nullsFirst: true })
    .order('createdat', { ascending: true })

  if (error) {
    console.error('오늘 할 일 조회 오류:', error)
    return []
  }

  return (data || []).map(normalizeTask)
}

/**
 * 백로그 조회 (미완료 + 오늘 할 일이 아닌 항목)
 * @returns {Promise<Array>} 백로그 목록
 */
export async function getBacklogTasks() {
  const userId = await getCurrentUserId()
  if (!userId) {
    console.warn('로그인이 필요합니다.')
    return []
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('completed', false)
    .eq('istoday', false)
    .order('createdat', { ascending: true })

  if (error) {
    console.error('백로그 조회 오류:', error)
    return []
  }

  return (data || []).map(normalizeTask)
}

/**
 * 할 일 추가
 * @param {string} title - 할 일 제목
 * @param {string} category - 카테고리
 * @param {boolean} isToday - 오늘 할 일 여부
 * @returns {Promise<Object|null>} 생성된 할 일
 */
export async function createTask(title, category, isToday = false) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  // 카테고리가 없으면 기본 카테고리 사용
  const finalCategory = category || (await getDefaultCategory())

  const newTask = {
    title: title.trim(),
    completed: false,
    istoday: isToday,
    category: finalCategory,
    createdat: Date.now(),
    user_id: userId,
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert([newTask])
    .select()
    .single()

  if (error) {
    console.error('할 일 생성 오류:', error)
    throw error
  }

  return normalizeTask(data)
}

/**
 * 할 일 수정
 * @param {string} id - 할 일 ID
 * @param {Object} updates - 수정할 필드
 * @returns {Promise<Object|null>} 수정된 할 일
 */
export async function updateTask(id, updates) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  // camelCase를 소문자 컬럼명으로 변환
  const dbUpdates = {}
  if ('isToday' in updates) {
    dbUpdates.istoday = updates.isToday
  }
  if ('createdAt' in updates) {
    dbUpdates.createdat = updates.createdAt
  }
  if ('completedAt' in updates) {
    dbUpdates.completedat = updates.completedAt
  }
  if ('movedToTodayAt' in updates) {
    dbUpdates.movedtotodayat = updates.movedToTodayAt
  }
  
  // completed가 true로 변경될 때 completedAt 설정
  if ('completed' in updates && updates.completed === true) {
    dbUpdates.completedat = Date.now()
  }
  // completed가 false로 변경될 때 completedAt 초기화
  if ('completed' in updates && updates.completed === false) {
    dbUpdates.completedat = null
  }
  
  Object.assign(dbUpdates, updates)
  delete dbUpdates.isToday
  delete dbUpdates.createdAt
  delete dbUpdates.completedAt
  delete dbUpdates.movedToTodayAt
  // memo는 그대로 사용 (소문자 컬럼명과 동일)

  const { data, error } = await supabase
    .from('tasks')
    .update(dbUpdates)
    .select()
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('할 일 수정 오류:', error)
    throw error
  }

  return normalizeTask(data)
}

/**
 * 할 일 삭제
 * @param {string} id - 할 일 ID
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
export async function deleteTask(id) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('할 일 삭제 오류:', error)
    throw error
  }

  return true
}

/**
 * 오늘 할 일로 이동
 * @param {string} id - 할 일 ID
 * @returns {Promise<Object|null>} 수정된 할 일
 */
export async function moveToToday(id) {
  return updateTask(id, { istoday: true, movedToTodayAt: Date.now() })
}

/**
 * 백로그로 이동
 * @param {string} id - 할 일 ID
 * @returns {Promise<Object|null>} 수정된 할 일
 */
export async function moveToBacklog(id) {
  return updateTask(id, { istoday: false })
}

/**
 * 날짜 변경 시 오늘 할 일 리셋
 * 완료된 항목과 미완료 항목 모두 백로그로 이동 (삭제하지 않음)
 * @returns {Promise<Object>} 리셋 결과 (백로그로 이동한 개수)
 */
export async function resetTodayTasks() {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    // 오늘 할 일 중 모든 항목 조회 (완료/미완료 모두)
    const { data: allTodayTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('istoday', true)

    if (fetchError) {
      console.error('오늘 할 일 조회 오류:', fetchError)
      throw fetchError
    }

    // 모든 오늘 할 일 항목을 백로그로 이동 (삭제하지 않음)
    let movedCount = 0
    if (allTodayTasks && allTodayTasks.length > 0) {
      const allIds = allTodayTasks.map((t) => t.id)
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ istoday: false })
        .in('id', allIds)
        .eq('user_id', userId)

      if (updateError) {
        console.error('백로그 이동 오류:', updateError)
        throw updateError
      }
      movedCount = allIds.length
    }

    return {
      movedCount,
    }
  } catch (error) {
    console.error('오늘 할 일 리셋 오류:', error)
    throw error
  }
}

/**
 * 특정 월의 날짜별 완료 개수 조회
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {Promise<Object>} 날짜별 완료 개수 객체 (키: 'YYYY-MM-DD', 값: 개수)
 */
export async function getCompletedCountsByDate(year, month) {
  const userId = await getCurrentUserId()
  if (!userId) {
    console.warn('로그인이 필요합니다.')
    return {}
  }

  try {
    // 해당 월의 시작과 끝 타임스탬프 계산
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)
    const startTimestamp = startDate.getTime()
    const endTimestamp = endDate.getTime()

    // 완료된 항목 중 해당 월에 완료된 것들 조회
    const { data, error } = await supabase
      .from('tasks')
      .select('completedat')
      .eq('user_id', userId)
      .eq('completed', true)
      .not('completedat', 'is', null)
      .gte('completedat', startTimestamp)
      .lte('completedat', endTimestamp)

    if (error) {
      console.error('완료 개수 조회 오류:', error)
      throw error
    }

    // 날짜별로 그룹화
    const countsByDate = {}
    if (data && data.length > 0) {
      data.forEach((task) => {
        const date = new Date(task.completedat)
        const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        countsByDate[dateString] = (countsByDate[dateString] || 0) + 1
      })
    }

    return countsByDate
  } catch (error) {
    console.error('날짜별 완료 개수 조회 오류:', error)
    throw error
  }
}

/**
 * 특정 날짜에 완료한 할 일 목록 조회
 * @param {string} dateString - 날짜 문자열 (YYYY-MM-DD)
 * @returns {Promise<Array>} 완료한 할 일 목록
 */
export async function getCompletedTasksByDate(dateString) {
  const userId = await getCurrentUserId()
  if (!userId) {
    console.warn('로그인이 필요합니다.')
    return []
  }

  try {
    // 날짜 문자열을 파싱하여 타임스탬프 범위 계산
    const [year, month, day] = dateString.split('-').map(Number)
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0)
    const endDate = new Date(year, month - 1, day, 23, 59, 59, 999)
    const startTimestamp = startDate.getTime()
    const endTimestamp = endDate.getTime()

    // 해당 날짜에 완료된 항목 조회
    // completedAt 기준 오름차순 (오래된 것부터 위, 최근 완료한 것이 아래)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', true)
      .not('completedat', 'is', null)
      .gte('completedat', startTimestamp)
      .lte('completedat', endTimestamp)
      .order('completedat', { ascending: true })

    if (error) {
      console.error('완료된 할 일 조회 오류:', error)
      throw error
    }

    return (data || []).map(normalizeTask)
  } catch (error) {
    console.error('날짜별 완료된 할 일 조회 오류:', error)
    throw error
  }
}

/**
 * 특정 월에 완료한 모든 할 일 목록 조회
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {Promise<Array>} 완료한 할 일 목록 (날짜별로 그룹화된 객체)
 */
export async function getCompletedTasksByMonth(year, month) {
  const userId = await getCurrentUserId()
  if (!userId) {
    console.warn('로그인이 필요합니다.')
    return {}
  }

  try {
    // 해당 월의 시작과 끝 타임스탬프 계산
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0)
    const endDate = new Date(year, month, 0, 23, 59, 59, 999)
    const startTimestamp = startDate.getTime()
    const endTimestamp = endDate.getTime()

    // 해당 월에 완료된 항목 조회
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', true)
      .not('completedat', 'is', null)
      .gte('completedat', startTimestamp)
      .lte('completedat', endTimestamp)
      .order('completedat', { ascending: true })

    if (error) {
      console.error('월별 완료된 할 일 조회 오류:', error)
      throw error
    }

    const tasks = (data || []).map(normalizeTask)

    // 날짜별로 그룹화
    const tasksByDate = {}
    tasks.forEach((task) => {
      const date = new Date(task.completedAt)
      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      if (!tasksByDate[dateString]) {
        tasksByDate[dateString] = []
      }
      tasksByDate[dateString].push(task)
    })

    return tasksByDate
  } catch (error) {
    console.error('월별 완료된 할 일 조회 오류:', error)
    throw error
  }
}

