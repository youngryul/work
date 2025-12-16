import { supabase } from '../config/supabase.js'
import { getDefaultCategory } from './categoryService.js'

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
  }
}

/**
 * 모든 할 일 조회
 * @returns {Promise<Array>} 할 일 목록
 */
export async function getAllTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
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
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('istoday', true)
    .order('createdat', { ascending: false })

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
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
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
  // 카테고리가 없으면 기본 카테고리 사용
  const finalCategory = category || (await getDefaultCategory())

  const newTask = {
    title: title.trim(),
    completed: false,
    istoday: isToday,
    category: finalCategory,
    createdat: Date.now(),
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

  const { data, error } = await supabase
    .from('tasks')
    .update(dbUpdates)
    .eq('id', id)
    .select()
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
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)

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
  return updateTask(id, { istoday: true })
}

/**
 * 날짜 변경 시 오늘 할 일 리셋
 * 완료된 항목은 삭제하고, 미완료 항목은 백로그로 이동
 * @returns {Promise<Object>} 리셋 결과 (삭제된 개수, 백로그로 이동한 개수)
 */
export async function resetTodayTasks() {
  try {
    // 오늘 할 일 중 완료된 항목 조회
    const { data: completedTasks, error: completedError } = await supabase
      .from('tasks')
      .select('id')
      .eq('istoday', true)
      .eq('completed', true)

    if (completedError) {
      console.error('완료된 할 일 조회 오류:', completedError)
      throw completedError
    }

    // 완료된 항목 삭제
    let deletedCount = 0
    if (completedTasks && completedTasks.length > 0) {
      const completedIds = completedTasks.map((t) => t.id)
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .in('id', completedIds)

      if (deleteError) {
        console.error('완료된 할 일 삭제 오류:', deleteError)
        throw deleteError
      }
      deletedCount = completedIds.length
    }

    // 오늘 할 일 중 미완료 항목을 백로그로 이동
    const { data: incompleteTasks, error: incompleteError } = await supabase
      .from('tasks')
      .select('id')
      .eq('istoday', true)
      .eq('completed', false)

    if (incompleteError) {
      console.error('미완료 할 일 조회 오류:', incompleteError)
      throw incompleteError
    }

    let movedCount = 0
    if (incompleteTasks && incompleteTasks.length > 0) {
      const incompleteIds = incompleteTasks.map((t) => t.id)
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ istoday: false })
        .in('id', incompleteIds)

      if (updateError) {
        console.error('백로그 이동 오류:', updateError)
        throw updateError
      }
      movedCount = incompleteIds.length
    }

    return {
      deletedCount,
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
  try {
    // 날짜 문자열을 파싱하여 타임스탬프 범위 계산
    const [year, month, day] = dateString.split('-').map(Number)
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0)
    const endDate = new Date(year, month - 1, day, 23, 59, 59, 999)
    const startTimestamp = startDate.getTime()
    const endTimestamp = endDate.getTime()

    // 해당 날짜에 완료된 항목 조회
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('completed', true)
      .not('completedat', 'is', null)
      .gte('completedat', startTimestamp)
      .lte('completedat', endTimestamp)
      .order('completedat', { ascending: false })

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

