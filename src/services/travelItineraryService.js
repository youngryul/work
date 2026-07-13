import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * @param {Object} row
 */
function normalizeTrip(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    countryCode: row.country_code,
    departureAt: row.departure_at,
    returnAt: row.return_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {Object} row
 */
function normalizeItem(row) {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    itemDate: row.item_date,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    title: row.title,
    memo: row.memo || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {number} minute
 */
function assertHalfHour(minute, label) {
  if (!Number.isInteger(minute) || minute % 30 !== 0) {
    throw new Error(`${label}은 30분 단위여야 합니다.`)
  }
}

/**
 * 해외 여행 목록
 * @returns {Promise<Array>}
 */
export async function getAbroadTrips() {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('travel_abroad_trips')
    .select('*')
    .eq('user_id', userId)
    .order('departure_at', { ascending: false })

  if (error) {
    console.error('해외 여행 목록 조회 오류:', error)
    throw error
  }

  return (data || []).map(normalizeTrip)
}

/**
 * @param {string} tripId
 */
export async function getAbroadTripById(tripId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('travel_abroad_trips')
    .select('*')
    .eq('id', tripId)
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('해외 여행 조회 오류:', error)
    throw error
  }

  return normalizeTrip(data)
}

/**
 * @param {{
 *   title: string,
 *   countryCode: string,
 *   departureAt: string,
 *   returnAt: string,
 * }} params
 */
export async function createAbroadTrip(params) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const title = (params.title || '').trim()
  const countryCode = (params.countryCode || '').trim().toUpperCase()
  const departureAt = params.departureAt
  const returnAt = params.returnAt

  if (!title) throw new Error('여행 제목을 입력해주세요.')
  if (!countryCode || countryCode.length !== 2) throw new Error('여행 국가를 선택해주세요.')
  if (countryCode === 'KR') throw new Error('해외 여행만 등록할 수 있습니다.')
  if (!departureAt || !returnAt) throw new Error('출국일과 귀국일을 입력해주세요.')
  if (new Date(returnAt) <= new Date(departureAt)) {
    throw new Error('귀국 시각은 출국 시각보다 늦어야 합니다.')
  }

  const { data, error } = await supabase
    .from('travel_abroad_trips')
    .insert([
      {
        user_id: userId,
        title,
        country_code: countryCode,
        departure_at: departureAt,
        return_at: returnAt,
      },
    ])
    .select('*')
    .single()

  if (error) {
    console.error('해외 여행 생성 오류:', error)
    throw error
  }

  return normalizeTrip(data)
}

/**
 * @param {string} tripId
 * @param {{ title?: string, countryCode?: string, departureAt?: string, returnAt?: string }} params
 */
export async function updateAbroadTrip(tripId, params) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const patch = { updated_at: new Date().toISOString() }
  if (params.title != null) {
    const title = params.title.trim()
    if (!title) throw new Error('여행 제목을 입력해주세요.')
    patch.title = title
  }
  if (params.countryCode != null) {
    const countryCode = params.countryCode.trim().toUpperCase()
    if (countryCode === 'KR') throw new Error('해외 여행만 등록할 수 있습니다.')
    patch.country_code = countryCode
  }
  if (params.departureAt != null) patch.departure_at = params.departureAt
  if (params.returnAt != null) patch.return_at = params.returnAt

  if (patch.departure_at && patch.return_at && new Date(patch.return_at) <= new Date(patch.departure_at)) {
    throw new Error('귀국 시각은 출국 시각보다 늦어야 합니다.')
  }

  const { data, error } = await supabase
    .from('travel_abroad_trips')
    .update(patch)
    .eq('id', tripId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    console.error('해외 여행 수정 오류:', error)
    throw error
  }

  return normalizeTrip(data)
}

/**
 * @param {string} tripId
 */
export async function deleteAbroadTrip(tripId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('travel_abroad_trips')
    .delete()
    .eq('id', tripId)
    .eq('user_id', userId)

  if (error) {
    console.error('해외 여행 삭제 오류:', error)
    throw error
  }

  return true
}

/**
 * @param {string} tripId
 * @param {string} [itemDate] YYYY-MM-DD
 */
export async function getAbroadItineraryItems(tripId, itemDate) {
  const userId = await getCurrentUserId()
  if (!userId) return []

  let query = supabase
    .from('travel_abroad_itinerary_items')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .order('item_date', { ascending: true })
    .order('start_minute', { ascending: true })

  if (itemDate) {
    query = query.eq('item_date', itemDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('일정 항목 조회 오류:', error)
    throw error
  }

  return (data || []).map(normalizeItem)
}

/**
 * @param {{
 *   tripId: string,
 *   itemDate: string,
 *   startMinute: number,
 *   endMinute: number,
 *   title: string,
 *   memo?: string,
 *   tripDepartureAt: string,
 *   tripReturnAt: string,
 * }} params
 */
export async function createAbroadItineraryItem(params) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const title = (params.title || '').trim()
  const itemDate = (params.itemDate || '').trim()
  const startMinute = Number(params.startMinute)
  const endMinute = Number(params.endMinute)

  if (!title) throw new Error('일정 제목을 입력해주세요.')
  if (!itemDate) throw new Error('날짜를 선택해주세요.')
  assertHalfHour(startMinute, '시작 시각')
  assertHalfHour(endMinute, '종료 시각')
  if (endMinute <= startMinute) throw new Error('종료 시각은 시작 시각보다 늦어야 합니다.')
  if (endMinute > 1440 || startMinute < 0) throw new Error('시각 범위를 확인해주세요.')

  const tripStartDate = toDateKey(params.tripDepartureAt)
  const tripEndDate = toDateKey(params.tripReturnAt)
  if (itemDate < tripStartDate || itemDate > tripEndDate) {
    throw new Error('출국일~귀국일 안에서만 일정을 등록할 수 있습니다.')
  }

  const { data, error } = await supabase
    .from('travel_abroad_itinerary_items')
    .insert([
      {
        trip_id: params.tripId,
        user_id: userId,
        item_date: itemDate,
        start_minute: startMinute,
        end_minute: endMinute,
        title,
        memo: (params.memo || '').trim() || null,
      },
    ])
    .select('*')
    .single()

  if (error) {
    console.error('일정 항목 생성 오류:', error)
    throw error
  }

  return normalizeItem(data)
}

/**
 * @param {string} itemId
 * @param {{
 *   itemDate?: string,
 *   startMinute?: number,
 *   endMinute?: number,
 *   title?: string,
 *   memo?: string,
 *   tripDepartureAt?: string,
 *   tripReturnAt?: string,
 * }} params
 */
export async function updateAbroadItineraryItem(itemId, params) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const patch = { updated_at: new Date().toISOString() }

  if (params.title != null) {
    const title = params.title.trim()
    if (!title) throw new Error('일정 제목을 입력해주세요.')
    patch.title = title
  }
  if (params.memo != null) patch.memo = params.memo.trim() || null
  if (params.itemDate != null) patch.item_date = params.itemDate
  if (params.startMinute != null) {
    assertHalfHour(Number(params.startMinute), '시작 시각')
    patch.start_minute = Number(params.startMinute)
  }
  if (params.endMinute != null) {
    assertHalfHour(Number(params.endMinute), '종료 시각')
    patch.end_minute = Number(params.endMinute)
  }

  const start = patch.start_minute
  const end = patch.end_minute
  if (start != null && end != null && end <= start) {
    throw new Error('종료 시각은 시작 시각보다 늦어야 합니다.')
  }

  if (patch.item_date && params.tripDepartureAt && params.tripReturnAt) {
    const tripStartDate = toDateKey(params.tripDepartureAt)
    const tripEndDate = toDateKey(params.tripReturnAt)
    if (patch.item_date < tripStartDate || patch.item_date > tripEndDate) {
      throw new Error('출국일~귀국일 안에서만 일정을 등록할 수 있습니다.')
    }
  }

  const { data, error } = await supabase
    .from('travel_abroad_itinerary_items')
    .update(patch)
    .eq('id', itemId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    console.error('일정 항목 수정 오류:', error)
    throw error
  }

  return normalizeItem(data)
}

/**
 * @param {string} itemId
 */
export async function deleteAbroadItineraryItem(itemId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('travel_abroad_itinerary_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId)

  if (error) {
    console.error('일정 항목 삭제 오류:', error)
    throw error
  }

  return true
}

/**
 * ISO 시각 → YYYY-MM-DD (로컬 달력 기준이 아니라 UTC date 부분 사용하지 않고,
 * 사용자가 선택한 date input 값을 그대로 쓰는 편이 안전하므로 보조 유틸만 제공)
 * @param {string} isoOrDate
 * @returns {string}
 */
export function toDateKey(isoOrDate) {
  if (!isoOrDate) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * @param {number} minute
 * @returns {string} HH:MM
 */
export function minuteToTimeLabel(minute) {
  const clamped = Math.max(0, Math.min(1440, minute))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  if (clamped === 1440) return '24:00'
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * @param {string} time HH:MM
 * @returns {number}
 */
export function timeLabelToMinute(time) {
  const [h, m] = (time || '00:00').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * 출국~귀국 사이 날짜 키 배열 (로컬 Date 기준)
 * @param {string} departureAt
 * @param {string} returnAt
 * @returns {string[]}
 */
export function buildTripDateKeys(departureAt, returnAt) {
  const start = toDateKey(departureAt)
  const end = toDateKey(returnAt)
  if (!start || !end || end < start) return []

  const dates = []
  const cursor = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (cursor <= last) {
    const y = cursor.getFullYear()
    const mo = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    dates.push(`${y}-${mo}-${d}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}
