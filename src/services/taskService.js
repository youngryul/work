import { supabase } from '../config/supabase.js'
import { DEFAULT_CATEGORY, MAX_TODAY_TASKS } from '../constants/categories.js'

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
    .order('createdat', { ascending: false })

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
  // 오늘 할 일 개수 확인
  if (isToday) {
    const todayTasks = await getTodayTasks()
    if (todayTasks.length >= MAX_TODAY_TASKS) {
      throw new Error(`오늘 할 일은 최대 ${MAX_TODAY_TASKS}개까지 선택할 수 있습니다.`)
    }
  }

  const newTask = {
    title: title.trim(),
    completed: false,
    istoday: isToday,
    category: category || DEFAULT_CATEGORY,
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
  Object.assign(dbUpdates, updates)
  delete dbUpdates.isToday
  delete dbUpdates.createdAt

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
  const todayTasks = await getTodayTasks()
  if (todayTasks.length >= MAX_TODAY_TASKS) {
    throw new Error(`오늘 할 일은 최대 ${MAX_TODAY_TASKS}개까지 선택할 수 있습니다.`)
  }

  return updateTask(id, { istoday: true })
}

