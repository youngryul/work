import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import {
  DEFAULT_SCHEDULE_REPEAT_TYPE,
  expandScheduleForRange,
  getScheduleSeriesId,
  normalizeScheduleMonthlyRule,
  normalizeScheduleRepeatEndType,
  normalizeScheduleRepeatType,
  normalizeScheduleWeekdays,
} from '../utils/scheduleRepeat.js'

/** 연속 일정 최대 일수 */
export const MAX_SCHEDULE_RANGE_DAYS = 366

export {
  SCHEDULE_REPEAT_TYPES,
  describeScheduleRepeat,
  getScheduleRepeatLabel,
  getScheduleSeriesId,
} from '../utils/scheduleRepeat.js'

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
/**
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {number}
 */
function countDaysInclusive(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const diffMs = end.getTime() - start.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
}

/**
 * @param {string} startDate
 * @param {string} endDate
 */
function assertValidScheduleRange(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new Error('시작일과 종료일을 확인해주세요.')
  }
  if (endDate < startDate) {
    throw new Error('종료일은 시작일보다 빠를 수 없습니다.')
  }
  const days = countDaysInclusive(startDate, endDate)
  if (days > MAX_SCHEDULE_RANGE_DAYS) {
    throw new Error(`연속 일정은 최대 ${MAX_SCHEDULE_RANGE_DAYS}일까지 등록할 수 있습니다.`)
  }
}

function normalizeSchedule(row) {
  const scheduleDate = row.schedule_date
  const endDate = row.end_date || scheduleDate
  const repeatType = normalizeScheduleRepeatType(row.repeat_type)
  let repeatEndType = normalizeScheduleRepeatEndType(row.repeat_end_type)
  // 구 데이터: end_type 없고 until만 있으면 until로 간주
  if (!row.repeat_end_type && row.repeat_until) {
    repeatEndType = 'until'
  }

  return {
    id: row.id,
    userId: row.user_id,
    scheduleDate,
    endDate,
    title: row.title,
    tag: row.tag,
    repeatType,
    repeatInterval: Math.max(1, Number(row.repeat_interval) || 1),
    repeatWeekdays: normalizeScheduleWeekdays(row.repeat_weekdays),
    repeatMonthlyRule: normalizeScheduleMonthlyRule(row.repeat_monthly_rule),
    repeatMonthDay: Number(row.repeat_month_day) || null,
    repeatNth: Number(row.repeat_nth) || null,
    repeatWeekday: Number.isFinite(Number(row.repeat_weekday))
      ? Number(row.repeat_weekday)
      : null,
    repeatEndType,
    repeatCount: Number(row.repeat_count) || null,
    repeatUntil: row.repeat_until || null,
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
 * 특정 월의 일정 목록을 조회합니다. (반복 일정은 해당 월 발생분으로 펼침)
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

  const [plainResult, recurringResult] = await Promise.all([
    supabase
      .from('schedule_calendar_events')
      .select('*')
      .eq('user_id', userId)
      .or('repeat_type.is.null,repeat_type.eq.none')
      .lte('schedule_date', endDate)
      .or(`end_date.gte.${startDate},and(end_date.is.null,schedule_date.gte.${startDate})`)
      .order('schedule_date', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('schedule_calendar_events')
      .select('*')
      .eq('user_id', userId)
      .in('repeat_type', ['weekly', 'monthly', 'yearly'])
      .lte('schedule_date', endDate)
      .or(`repeat_until.is.null,repeat_until.gte.${startDate}`)
      .order('schedule_date', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (plainResult.error) {
    // 구 DB(repeat_type 없음) 폴백
    if (plainResult.error.code === '42703' || /repeat_type/i.test(plainResult.error.message || '')) {
      return getSchedulesByMonthLegacy(userId, startDate, endDate)
    }
    console.error('일정 조회 오류:', plainResult.error)
    throw plainResult.error
  }
  if (recurringResult.error) {
    console.error('반복 일정 조회 오류:', recurringResult.error)
    throw recurringResult.error
  }

  const masters = [
    ...(plainResult.data || []).map(normalizeSchedule),
    ...(recurringResult.data || []).map(normalizeSchedule),
  ]

  const expanded = masters.flatMap((schedule) =>
    expandScheduleForRange(schedule, startDate, endDate),
  )

  expanded.sort((a, b) => {
    if (a.scheduleDate !== b.scheduleDate) {
      return a.scheduleDate.localeCompare(b.scheduleDate)
    }
    return String(a.title || '').localeCompare(String(b.title || ''))
  })

  return expanded
}

/**
 * @param {string} userId
 * @param {string} startDate
 * @param {string} endDate
 */
async function getSchedulesByMonthLegacy(userId, startDate, endDate) {
  const { data, error } = await supabase
    .from('schedule_calendar_events')
    .select('*')
    .eq('user_id', userId)
    .lte('schedule_date', endDate)
    .or(`end_date.gte.${startDate},and(end_date.is.null,schedule_date.gte.${startDate})`)
    .order('schedule_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('일정 조회 오류:', error)
    throw error
  }

  return (data || []).map((row) => ({
    ...normalizeSchedule({ ...row, repeat_type: 'none' }),
    seriesId: row.id,
    isOccurrence: false,
  }))
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
 * 일정을 등록합니다. endDate가 없거나 시작일과 같으면 단일 일정입니다.
 * @param {object} params
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

  const scheduleDate = (params.scheduleDate || '').trim()
  const endDate = (params.endDate || scheduleDate).trim()
  assertValidScheduleRange(scheduleDate, endDate)

  const repeatType = normalizeScheduleRepeatType(params.repeatType)
  const repeatInterval = Math.max(1, Number(params.repeatInterval) || 1)
  const repeatEndType =
    repeatType === DEFAULT_SCHEDULE_REPEAT_TYPE
      ? 'never'
      : normalizeScheduleRepeatEndType(params.repeatEndType)

  let repeatUntil = (params.repeatUntil || '').trim() || null
  let repeatCount = Number(params.repeatCount) || null
  const repeatWeekdays = normalizeScheduleWeekdays(params.repeatWeekdays)
  const repeatMonthlyRule = normalizeScheduleMonthlyRule(params.repeatMonthlyRule)
  const repeatMonthDay = Number(params.repeatMonthDay) || null
  const repeatNth = Number(params.repeatNth) || null
  const repeatWeekday = Number.isFinite(Number(params.repeatWeekday))
    ? Number(params.repeatWeekday)
    : null

  if (repeatType !== DEFAULT_SCHEDULE_REPEAT_TYPE) {
    if (repeatType === 'weekly' && repeatWeekdays.length === 0) {
      throw new Error('반복할 요일을 하나 이상 선택해주세요.')
    }
    if (repeatEndType === 'until') {
      if (!repeatUntil) {
        throw new Error('반복 종료일을 선택해주세요.')
      }
      if (repeatUntil < scheduleDate) {
        throw new Error('반복 종료일은 시작일보다 빠를 수 없습니다.')
      }
    } else if (repeatEndType === 'count') {
      if (!repeatCount || repeatCount < 1) {
        throw new Error('반복 횟수를 입력해주세요.')
      }
      repeatUntil = null
    } else {
      repeatUntil = null
      repeatCount = null
    }
  } else {
    repeatUntil = null
    repeatCount = null
  }

  const insertRow = {
    user_id: userId,
    schedule_date: scheduleDate,
    end_date: endDate,
    title,
    tag: (params.tag || '기타').trim() || '기타',
    repeat_type: repeatType,
    repeat_interval: repeatInterval,
    repeat_weekdays:
      repeatType === 'weekly' ? repeatWeekdays.join(',') : null,
    repeat_monthly_rule: repeatType === 'monthly' ? repeatMonthlyRule : 'day',
    repeat_month_day:
      repeatType === 'monthly' && repeatMonthlyRule === 'day'
        ? repeatMonthDay || Number(scheduleDate.slice(8, 10))
        : null,
    repeat_nth:
      repeatType === 'monthly' && repeatMonthlyRule === 'nth_weekday'
        ? repeatNth || 1
        : null,
    repeat_weekday:
      repeatType === 'weekly'
        ? null
        : repeatType === 'monthly' &&
            (repeatMonthlyRule === 'nth_weekday' ||
              repeatMonthlyRule === 'last_weekday')
          ? repeatWeekday
          : null,
    repeat_end_type: repeatType === 'none' ? 'never' : repeatEndType,
    repeat_count: repeatEndType === 'count' ? repeatCount : null,
    repeat_until: repeatEndType === 'until' ? repeatUntil : null,
  }

  const { data, error } = await supabase
    .from('schedule_calendar_events')
    .insert([insertRow])
    .select()
    .single()

  if (error) {
    if (error.code === '42703' || /repeat_/i.test(error.message || '')) {
      const { data: legacyData, error: legacyError } = await supabase
        .from('schedule_calendar_events')
        .insert([{
          user_id: userId,
          schedule_date: scheduleDate,
          end_date: endDate,
          title,
          tag: insertRow.tag,
        }])
        .select()
        .single()
      if (legacyError) {
        console.error('일정 등록 오류:', legacyError)
        throw legacyError
      }
      if (repeatType !== 'none') {
        throw new Error(
          '반복 일정 컬럼이 없습니다. supabase-schedule-repeat.sql 을 먼저 실행해주세요.',
        )
      }
      return normalizeSchedule({ ...legacyData, repeat_type: 'none' })
    }
    console.error('일정 등록 오류:', error)
    throw error
  }

  return normalizeSchedule(data)
}

/**
 * 일정을 삭제합니다. (반복 일정이면 시리즈 전체 삭제)
 * @param {string} scheduleId 발생 ID 또는 마스터 ID
 * @returns {Promise<void>}
 */
export async function deleteSchedule(scheduleId) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const seriesId = getScheduleSeriesId(scheduleId)
  if (!seriesId) {
    throw new Error('삭제할 일정을 확인해주세요.')
  }

  const { error } = await supabase
    .from('schedule_calendar_events')
    .delete()
    .eq('id', seriesId)
    .eq('user_id', userId)

  if (error) {
    console.error('일정 삭제 오류:', error)
    throw error
  }
}

/**
 * 일정 기간(시작·종료일)을 수정합니다.
 * @param {{scheduleId: string, scheduleDate: string, endDate?: string}} params
 * @returns {Promise<Object>}
 */
export async function updateScheduleDate(params) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const scheduleId = getScheduleSeriesId(params.scheduleId)
  const scheduleDate = (params.scheduleDate || '').trim()
  const endDate = (params.endDate || scheduleDate).trim()
  if (!scheduleId || !scheduleDate) {
    throw new Error('수정할 일정 정보를 확인해주세요.')
  }
  assertValidScheduleRange(scheduleDate, endDate)

  const { data, error } = await supabase
    .from('schedule_calendar_events')
    .update({
      schedule_date: scheduleDate,
      end_date: endDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scheduleId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    console.error('일정 날짜 수정 오류:', error)
    throw error
  }

  return normalizeSchedule(data)
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
