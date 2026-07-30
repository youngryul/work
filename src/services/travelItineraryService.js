import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { uploadImage } from './imageService.js'

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
  const placeLat = row.place_lat == null ? null : Number(row.place_lat)
  const placeLng = row.place_lng == null ? null : Number(row.place_lng)
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    itemDate: row.item_date,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
    title: row.title,
    memo: row.memo || '',
    placeName: row.place_name || '',
    placeAddress: row.place_address || '',
    placeLat: Number.isFinite(placeLat) ? placeLat : null,
    placeLng: Number.isFinite(placeLng) ? placeLng : null,
    googlePlaceId: row.google_place_id || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {object} params
 */
function buildPlacePatch(params) {
  const placeName = (params.placeName || '').trim()
  const placeAddress = (params.placeAddress || '').trim()
  const googlePlaceId = (params.googlePlaceId || '').trim()
  const placeLat =
    params.placeLat == null || params.placeLat === ''
      ? null
      : Number(params.placeLat)
  const placeLng =
    params.placeLng == null || params.placeLng === ''
      ? null
      : Number(params.placeLng)

  return {
    place_name: placeName || null,
    place_address: placeAddress || null,
    place_lat: Number.isFinite(placeLat) ? placeLat : null,
    place_lng: Number.isFinite(placeLng) ? placeLng : null,
    google_place_id: googlePlaceId || null,
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
 *   placeName?: string,
 *   placeAddress?: string,
 *   placeLat?: number | null,
 *   placeLng?: number | null,
 *   googlePlaceId?: string,
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
        ...buildPlacePatch(params),
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
 *   placeName?: string,
 *   placeAddress?: string,
 *   placeLat?: number | null,
 *   placeLng?: number | null,
 *   googlePlaceId?: string,
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
  if (
    params.placeName != null ||
    params.placeAddress != null ||
    params.placeLat !== undefined ||
    params.placeLng !== undefined ||
    params.googlePlaceId != null
  ) {
    Object.assign(patch, buildPlacePatch(params))
  }
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

function normalizePackingItem(row) {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    title: row.title,
    imageUrl: row.image_url ?? row.imageUrl ?? null,
    isChecked: Boolean(row.is_checked),
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeSpareItem(row) {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    title: row.title,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 여행 준비물 목록
 * @param {string} tripId
 */
export async function getAbroadPackingItems(tripId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('travel_abroad_packing_items')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('준비물 목록 조회 오류:', error)
    throw error
  }

  return (data || []).map(normalizePackingItem)
}

/**
 * @param {{ tripId: string, title: string }} params
 */
export async function createAbroadPackingItem({ tripId, title }) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const trimmed = (title || '').trim()
  if (!trimmed) throw new Error('준비물 이름을 입력해주세요.')

  const { data, error } = await supabase
    .from('travel_abroad_packing_items')
    .insert([
      {
        trip_id: tripId,
        user_id: userId,
        title: trimmed,
        is_checked: false,
        sort_order: Date.now() % 1000000000,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('준비물 추가 오류:', error)
    throw error
  }

  return normalizePackingItem(data)
}

/**
 * @param {string} itemId
 * @param {{ title?: string, isChecked?: boolean }} updates
 */
export async function updateAbroadPackingItem(itemId, updates) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const payload = { updated_at: new Date().toISOString() }
  if (updates.title != null) {
    const trimmed = updates.title.trim()
    if (!trimmed) throw new Error('준비물 이름을 입력해주세요.')
    payload.title = trimmed
  }
  if (updates.isChecked != null) {
    payload.is_checked = Boolean(updates.isChecked)
  }

  const { data, error } = await supabase
    .from('travel_abroad_packing_items')
    .update(payload)
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('준비물 수정 오류:', error)
    throw error
  }

  return normalizePackingItem(data)
}

/**
 * @param {string} itemId
 */
export async function deleteAbroadPackingItem(itemId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('travel_abroad_packing_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId)

  if (error) {
    console.error('준비물 삭제 오류:', error)
    throw error
  }

  return true
}

/**
 * 여행 기념품 목록
 * @param {string} tripId
 */
export async function getAbroadSouvenirItems(tripId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('travel_abroad_souvenir_items')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('기념품 목록 조회 오류:', error)
    throw error
  }

  return (data || []).map(normalizePackingItem)
}

/**
 * @param {{ tripId: string, title: string, imageFile?: File | null }} params
 */
export async function createAbroadSouvenirItem({ tripId, title, imageFile = null }) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const trimmed = (title || '').trim()
  if (!trimmed) throw new Error('기념품 이름을 입력해주세요.')
  const imageUrl = imageFile ? await uploadImage(imageFile, 'travel-souvenirs') : null

  const { data, error } = await supabase
    .from('travel_abroad_souvenir_items')
    .insert([
      {
        trip_id: tripId,
        user_id: userId,
        title: trimmed,
        image_url: imageUrl,
        is_checked: false,
        sort_order: Date.now() % 1000000000,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('기념품 추가 오류:', error)
    throw error
  }

  return normalizePackingItem(data)
}

/**
 * @param {string} itemId
 * @param {{ title?: string, isChecked?: boolean, imageFile?: File | null, clearImage?: boolean }} updates
 */
export async function updateAbroadSouvenirItem(itemId, updates) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const payload = { updated_at: new Date().toISOString() }
  if (updates.title != null) {
    const trimmed = updates.title.trim()
    if (!trimmed) throw new Error('기념품 이름을 입력해주세요.')
    payload.title = trimmed
  }
  if (updates.isChecked != null) {
    payload.is_checked = Boolean(updates.isChecked)
  }
  if (updates.imageFile) {
    payload.image_url = await uploadImage(updates.imageFile, 'travel-souvenirs')
  } else if (updates.clearImage) {
    payload.image_url = null
  }

  const { data, error } = await supabase
    .from('travel_abroad_souvenir_items')
    .update(payload)
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('기념품 수정 오류:', error)
    throw error
  }

  return normalizePackingItem(data)
}

/**
 * @param {string} itemId
 */
export async function deleteAbroadSouvenirItem(itemId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('travel_abroad_souvenir_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId)

  if (error) {
    console.error('기념품 삭제 오류:', error)
    throw error
  }

  return true
}

/**
 * 예비 일정 목록
 * @param {string} tripId
 */
export async function getAbroadSpareItems(tripId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('travel_abroad_spare_items')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('예비 일정 목록 조회 오류:', error)
    throw error
  }

  return (data || []).map(normalizeSpareItem)
}

/**
 * @param {{ tripId: string, title: string }} params
 */
export async function createAbroadSpareItem({ tripId, title }) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const trimmed = (title || '').trim()
  if (!trimmed) throw new Error('예비 일정 제목을 입력해주세요.')

  const { data, error } = await supabase
    .from('travel_abroad_spare_items')
    .insert([
      {
        trip_id: tripId,
        user_id: userId,
        title: trimmed,
        sort_order: Date.now() % 1000000000,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('예비 일정 추가 오류:', error)
    throw error
  }

  return normalizeSpareItem(data)
}

/**
 * @param {string} itemId
 * @param {{ title: string }} updates
 */
export async function updateAbroadSpareItem(itemId, updates) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const trimmed = (updates.title || '').trim()
  if (!trimmed) throw new Error('예비 일정 제목을 입력해주세요.')

  const { data, error } = await supabase
    .from('travel_abroad_spare_items')
    .update({
      title: trimmed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('예비 일정 수정 오류:', error)
    throw error
  }

  return normalizeSpareItem(data)
}

/**
 * @param {string} itemId
 */
export async function deleteAbroadSpareItem(itemId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('travel_abroad_spare_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', userId)

  if (error) {
    console.error('예비 일정 삭제 오류:', error)
    throw error
  }

  return true
}

/** 여행 폴라로이드 앨범 최대 장수 */
export const TRAVEL_ALBUM_MAX_PHOTOS = 10

/**
 * @param {Object} row
 */
function normalizeAlbumPhoto(row) {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    imageUrl: row.image_url,
    caption: row.caption || '',
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 여행 앨범 사진 목록
 * @param {string} tripId
 */
export async function getAbroadAlbumPhotos(tripId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('travel_abroad_album_photos')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('여행 앨범 조회 오류:', error)
    throw error
  }

  return (data || []).map(normalizeAlbumPhoto)
}

/**
 * @param {{ tripId: string, imageFile: File, caption?: string }} params
 */
export async function createAbroadAlbumPhoto({ tripId, imageFile, caption = '' }) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')
  if (!imageFile) throw new Error('사진을 선택해주세요.')

  const existing = await getAbroadAlbumPhotos(tripId)
  if (existing.length >= TRAVEL_ALBUM_MAX_PHOTOS) {
    throw new Error(`앨범은 최대 ${TRAVEL_ALBUM_MAX_PHOTOS}장까지 추가할 수 있습니다.`)
  }

  const imageUrl = await uploadImage(imageFile, 'travel-albums')
  const captionText = (caption || '').trim().slice(0, 40)

  const { data, error } = await supabase
    .from('travel_abroad_album_photos')
    .insert([
      {
        trip_id: tripId,
        user_id: userId,
        image_url: imageUrl,
        caption: captionText,
        sort_order: existing.length,
      },
    ])
    .select()
    .single()

  if (error) {
    console.error('여행 앨범 사진 추가 오류:', error)
    throw error
  }

  return normalizeAlbumPhoto(data)
}

/**
 * 여러 장 일괄 추가 (잔여 슬롯만큼)
 * @param {{ tripId: string, imageFiles: File[] }} params
 */
export async function createAbroadAlbumPhotosBatch({ tripId, imageFiles }) {
  const files = (imageFiles || []).filter((file) => file?.type?.startsWith('image/'))
  if (files.length === 0) throw new Error('이미지 파일을 선택해주세요.')

  const existing = await getAbroadAlbumPhotos(tripId)
  const remaining = TRAVEL_ALBUM_MAX_PHOTOS - existing.length
  if (remaining <= 0) {
    throw new Error(`앨범은 최대 ${TRAVEL_ALBUM_MAX_PHOTOS}장까지 추가할 수 있습니다.`)
  }

  const toUpload = files.slice(0, remaining)
  const created = []
  for (let i = 0; i < toUpload.length; i += 1) {
    const photo = await createAbroadAlbumPhoto({
      tripId,
      imageFile: toUpload[i],
      caption: '',
    })
    created.push(photo)
  }

  return {
    created,
    skipped: files.length - toUpload.length,
  }
}

/**
 * @param {string} photoId
 * @param {{ caption?: string }} updates
 */
export async function updateAbroadAlbumPhoto(photoId, updates) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const payload = { updated_at: new Date().toISOString() }
  if (updates.caption != null) {
    payload.caption = String(updates.caption).trim().slice(0, 40)
  }

  const { data, error } = await supabase
    .from('travel_abroad_album_photos')
    .update(payload)
    .eq('id', photoId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('여행 앨범 수정 오류:', error)
    throw error
  }

  return normalizeAlbumPhoto(data)
}

/**
 * @param {string} photoId
 */
export async function deleteAbroadAlbumPhoto(photoId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('travel_abroad_album_photos')
    .delete()
    .eq('id', photoId)
    .eq('user_id', userId)

  if (error) {
    console.error('여행 앨범 삭제 오류:', error)
    throw error
  }

  return true
}
