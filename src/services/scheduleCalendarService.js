import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

export const DEFAULT_SCHEDULE_TAGS = [
  { name: '업무', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { name: '개인', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { name: '약속', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { name: '가족', color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { name: '기타', color: 'bg-gray-100 text-gray-700 border-gray-200' },
]

/**
 * DB 컬럼을 앱 형식으로 변환합니다.
 * @param {Object} row
 * @returns {Object}
 */
function normalizeSchedule(row) {
  return {
    id: row.id,
    userId: row.user_id,
    scheduleDate: row.schedule_date,
    title: row.title,
    tag: row.tag,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 태그 DB 컬럼을 앱 형식으로 변환합니다.
 * @param {Object} row
 * @returns {Object}
 */
function normalizeTag(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 특정 월의 일정 목록을 조회합니다.
 * @param {number} year
 * @param {number} month - 1~12
 * @returns {Promise<Array>}
 */
export async function getSchedulesByMonth(year, month) {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDate = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('schedule_calendar_events')
    .select('*')
    .eq('user_id', userId)
    .gte('schedule_date', startDate)
    .lte('schedule_date', endDate)
    .order('schedule_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('일정 조회 오류:', error)
    throw error
  }

  return (data || []).map(normalizeSchedule)
}

/**
 * 현재 사용자 태그 목록을 조회합니다. 없으면 기본 태그를 생성합니다.
 * @returns {Promise<Array<{id:string,name:string,color:string}>>}
 */
export async function getOrCreateScheduleTagsForCurrentUser() {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('schedule_calendar_tags')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('태그 조회 오류:', error)
    throw error
  }

  if (data && data.length > 0) {
    return data.map(normalizeTag)
  }

  const seedRows = DEFAULT_SCHEDULE_TAGS.map((tag) => ({
    user_id: userId,
    name: tag.name,
    color: tag.color,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('schedule_calendar_tags')
    .insert(seedRows)
    .select('*')

  if (insertError) {
    console.error('기본 태그 생성 오류:', insertError)
    throw insertError
  }

  return (inserted || []).map(normalizeTag)
}

/**
 * 일정을 등록합니다.
 * @param {{scheduleDate: string, title: string, tag: string}} params
 * @returns {Promise<Object>}
 */
export async function createSchedule(params) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const title = (params.title || '').trim()
  if (!title) {
    throw new Error('일정 제목을 입력해주세요.')
  }

  const { data, error } = await supabase
    .from('schedule_calendar_events')
    .insert([{
      user_id: userId,
      schedule_date: params.scheduleDate,
      title,
      tag: (params.tag || '기타').trim() || '기타',
    }])
    .select()
    .single()

  if (error) {
    console.error('일정 등록 오류:', error)
    throw error
  }

  return normalizeSchedule(data)
}

/**
 * 일정을 삭제합니다.
 * @param {string} scheduleId
 * @returns {Promise<void>}
 */
export async function deleteSchedule(scheduleId) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const { error } = await supabase
    .from('schedule_calendar_events')
    .delete()
    .eq('id', scheduleId)
    .eq('user_id', userId)

  if (error) {
    console.error('일정 삭제 오류:', error)
    throw error
  }
}

/**
 * 태그를 추가합니다.
 * @param {{name:string,color:string}} params
 * @returns {Promise<Object>}
 */
export async function createScheduleTag(params) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }
  const name = (params.name || '').trim()
  const color = (params.color || '').trim()
  if (!name || !color) {
    throw new Error('태그 정보를 확인해주세요.')
  }

  const { data, error } = await supabase
    .from('schedule_calendar_tags')
    .insert([{
      user_id: userId,
      name,
      color,
    }])
    .select('*')
    .single()

  if (error) {
    console.error('태그 추가 오류:', error)
    throw error
  }

  return normalizeTag(data)
}

/**
 * 현재 사용자의 특정 태그명을 일괄 변경합니다.
 * @param {string} fromTag
 * @param {string} toTag
 * @returns {Promise<void>}
 */
export async function renameScheduleTagForUser(fromTag, toTag) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const from = (fromTag || '').trim()
  const to = (toTag || '').trim()
  if (!from || !to) {
    throw new Error('태그명을 확인해주세요.')
  }
  if (from === to) return

  const { error: tagError } = await supabase
    .from('schedule_calendar_tags')
    .update({
      name: to,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('name', from)

  if (tagError) {
    console.error('태그 테이블 이름 변경 오류:', tagError)
    throw tagError
  }

  const { error } = await supabase
    .from('schedule_calendar_events')
    .update({
      tag: to,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('tag', from)

  if (error) {
    console.error('태그 이름 변경 오류:', error)
    throw error
  }
}

/**
 * 현재 사용자의 특정 태그를 다른 태그로 대체합니다. (태그 삭제 시 사용)
 * @param {string} deletedTag
 * @param {string} fallbackTag
 * @returns {Promise<void>}
 */
export async function replaceScheduleTagForUser(deletedTag, fallbackTag) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const from = (deletedTag || '').trim()
  const to = (fallbackTag || '').trim()
  if (!from || !to) {
    throw new Error('태그명을 확인해주세요.')
  }
  if (from === to) return

  const { error: tagDeleteError } = await supabase
    .from('schedule_calendar_tags')
    .delete()
    .eq('user_id', userId)
    .eq('name', from)

  if (tagDeleteError) {
    console.error('태그 삭제 오류:', tagDeleteError)
    throw tagDeleteError
  }

  const { error } = await supabase
    .from('schedule_calendar_events')
    .update({
      tag: to,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('tag', from)

  if (error) {
    console.error('태그 대체 오류:', error)
    throw error
  }
}
