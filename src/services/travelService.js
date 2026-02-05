/**
 * 여행 기록 관리 서비스
 * 국내 여행 기록 및 회고 관리
 */
import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 데이터베이스 컬럼명을 camelCase로 변환 (여행)
 */
function normalizeTravel(travel) {
  if (!travel) return travel
  return {
    id: travel.id,
    userId: travel.user_id,
    title: travel.title,
    startDate: travel.start_date,
    endDate: travel.end_date,
    province: travel.province,
    city: travel.city,
    companionType: travel.companion_type,
    satisfactionScore: travel.satisfaction_score,
    oneLineReview: travel.one_line_review,
    isPublic: travel.is_public,
    isFavorite: travel.is_favorite,
    representativeImageUrl: travel.representative_image_url,
    createdAt: travel.created_at,
    updatedAt: travel.updated_at,
  }
}

/**
 * 데이터베이스 컬럼명을 camelCase로 변환 (장소)
 */
function normalizePlace(place) {
  if (!place) return place
  return {
    id: place.id,
    travelId: place.travel_id,
    name: place.name,
    category: place.category,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating,
    memo: place.memo,
    visitDate: place.visit_date,
    visitTime: place.visit_time,
    createdAt: place.created_at,
    updatedAt: place.updated_at,
  }
}

/**
 * 데이터베이스 컬럼명을 camelCase로 변환 (날짜별 기록)
 */
function normalizeDateRecord(record) {
  if (!record) return record
  return {
    id: record.id,
    travelId: record.travel_id,
    recordDate: record.record_date,
    content: record.content,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

/**
 * 데이터베이스 컬럼명을 camelCase로 변환 (사진)
 */
function normalizeImage(image) {
  if (!image) return image
  return {
    id: image.id,
    travelId: image.travel_id,
    dateRecordId: image.date_record_id,
    placeId: image.place_id,
    imageUrl: image.image_url,
    imageOrder: image.image_order,
    isRepresentative: image.is_representative,
    caption: image.caption,
    createdAt: image.created_at,
  }
}

// ==================== 여행 관리 ====================

/**
 * 모든 여행 목록 조회
 * @param {Object} filters - 필터 옵션 (search, province, city, startDate, endDate, companionType, isFavorite)
 * @returns {Promise<Array>} 여행 목록
 */
export async function getAllTravels(filters = {}) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    let query = supabase
      .from('travels')
      .select('*')
      .eq('user_id', userId)

    // 검색어 필터
    if (filters.search) {
      query = query.ilike('title', `%${filters.search}%`)
    }

    // 지역 필터
    if (filters.province) {
      query = query.eq('province', filters.province)
    }
    if (filters.city) {
      query = query.eq('city', filters.city)
    }

    // 기간 필터
    if (filters.startDate) {
      query = query.gte('start_date', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('end_date', filters.endDate)
    }

    // 동행 유형 필터
    if (filters.companionType) {
      query = query.eq('companion_type', filters.companionType)
    }

    // 즐겨찾기 필터
    if (filters.isFavorite !== undefined) {
      query = query.eq('is_favorite', filters.isFavorite)
    }

    query = query.order('start_date', { ascending: false })

    const { data, error } = await query

    if (error) {
      throw error
    }

    return (data || []).map(normalizeTravel)
  } catch (error) {
    console.error('여행 목록 조회 오류:', error)
    throw error
  }
}

/**
 * 여행 상세 조회 (관련 데이터 포함)
 * @param {string} id - 여행 ID
 * @returns {Promise<Object|null>} 여행 정보 및 관련 데이터
 */
export async function getTravelById(id) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  try {
    // 여행 기본 정보
    const { data: travelData, error: travelError } = await supabase
      .from('travels')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (travelError) {
      throw travelError
    }

    if (!travelData) {
      return null
    }

    const travel = normalizeTravel(travelData)

    // 태그 조회
    const { data: tags } = await supabase
      .from('travel_tags')
      .select('tag')
      .eq('travel_id', id)

    // 감정 태그 조회
    const { data: emotions } = await supabase
      .from('travel_emotions')
      .select('emotion')
      .eq('travel_id', id)

    // 장소 조회
    const { data: places } = await supabase
      .from('travel_places')
      .select('*')
      .eq('travel_id', id)
      .order('visit_date', { ascending: true })
      .order('visit_time', { ascending: true })

    // 날짜별 기록 조회
    const { data: dateRecords } = await supabase
      .from('travel_date_records')
      .select('*')
      .eq('travel_id', id)
      .order('record_date', { ascending: true })

    // 사진 조회
    const { data: images } = await supabase
      .from('travel_images')
      .select('*')
      .eq('travel_id', id)
      .order('image_order', { ascending: true })

    return {
      ...travel,
      tags: (tags || []).map(t => t.tag),
      emotions: (emotions || []).map(e => e.emotion),
      places: (places || []).map(normalizePlace),
      dateRecords: (dateRecords || []).map(normalizeDateRecord),
      images: (images || []).map(normalizeImage),
    }
  } catch (error) {
    console.error('여행 상세 조회 오류:', error)
    throw error
  }
}

/**
 * 여행 생성
 * @param {Object} travelData - 여행 데이터
 * @returns {Promise<Object>} 생성된 여행
 */
export async function createTravel(travelData) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    // 여행 기본 정보 생성
    const { data: travel, error: travelError } = await supabase
      .from('travels')
      .insert([{
        user_id: userId,
        title: travelData.title.trim(),
        start_date: travelData.startDate,
        end_date: travelData.endDate,
        province: travelData.province,
        city: travelData.city || null,
        companion_type: travelData.companionType || 'ALONE',
        satisfaction_score: travelData.satisfactionScore || null,
        one_line_review: travelData.oneLineReview || null,
        is_public: travelData.isPublic || false,
        is_favorite: travelData.isFavorite || false,
        representative_image_url: travelData.representativeImageUrl || null,
      }])
      .select()
      .single()

    if (travelError) {
      throw travelError
    }

    const normalizedTravel = normalizeTravel(travel)

    // 태그 추가
    if (travelData.tags && travelData.tags.length > 0) {
      await addTravelTags(normalizedTravel.id, travelData.tags)
    }

    // 감정 태그 추가
    if (travelData.emotions && travelData.emotions.length > 0) {
      await addTravelEmotions(normalizedTravel.id, travelData.emotions)
    }

    return normalizedTravel
  } catch (error) {
    console.error('여행 생성 오류:', error)
    throw error
  }
}

/**
 * 여행 수정
 * @param {string} id - 여행 ID
 * @param {Object} travelData - 수정할 데이터
 * @returns {Promise<Object>} 수정된 여행
 */
export async function updateTravel(id, travelData) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const updateData = {}
    if (travelData.title !== undefined) updateData.title = travelData.title.trim()
    if (travelData.startDate !== undefined) updateData.start_date = travelData.startDate
    if (travelData.endDate !== undefined) updateData.end_date = travelData.endDate
    if (travelData.province !== undefined) updateData.province = travelData.province
    if (travelData.city !== undefined) updateData.city = travelData.city
    if (travelData.companionType !== undefined) updateData.companion_type = travelData.companionType
    if (travelData.satisfactionScore !== undefined) updateData.satisfaction_score = travelData.satisfactionScore
    if (travelData.oneLineReview !== undefined) updateData.one_line_review = travelData.oneLineReview
    if (travelData.isPublic !== undefined) updateData.is_public = travelData.isPublic
    if (travelData.isFavorite !== undefined) updateData.is_favorite = travelData.isFavorite
    if (travelData.representativeImageUrl !== undefined) updateData.representative_image_url = travelData.representativeImageUrl

    const { data, error } = await supabase
      .from('travels')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      throw error
    }

    // 태그 업데이트
    if (travelData.tags !== undefined) {
      await updateTravelTags(id, travelData.tags)
    }

    // 감정 태그 업데이트
    if (travelData.emotions !== undefined) {
      await updateTravelEmotions(id, travelData.emotions)
    }

    return normalizeTravel(data)
  } catch (error) {
    console.error('여행 수정 오류:', error)
    throw error
  }
}

/**
 * 여행 삭제
 * @param {string} id - 여행 ID
 * @returns {Promise<void>}
 */
export async function deleteTravel(id) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const { error } = await supabase
      .from('travels')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('여행 삭제 오류:', error)
    throw error
  }
}

// ==================== 태그 관리 ====================

/**
 * 여행 태그 추가
 * @param {string} travelId - 여행 ID
 * @param {Array<string>} tags - 태그 목록
 * @returns {Promise<void>}
 */
export async function addTravelTags(travelId, tags) {
  if (!tags || tags.length === 0) return

  try {
    const tagData = tags.map(tag => ({
      travel_id: travelId,
      tag: tag.trim(),
    }))

    const { error } = await supabase
      .from('travel_tags')
      .upsert(tagData, { onConflict: 'travel_id,tag' })

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('태그 추가 오류:', error)
    throw error
  }
}

/**
 * 여행 태그 업데이트
 * @param {string} travelId - 여행 ID
 * @param {Array<string>} tags - 새로운 태그 목록
 * @returns {Promise<void>}
 */
export async function updateTravelTags(travelId, tags) {
  try {
    // 기존 태그 삭제
    await supabase
      .from('travel_tags')
      .delete()
      .eq('travel_id', travelId)

    // 새 태그 추가
    if (tags && tags.length > 0) {
      await addTravelTags(travelId, tags)
    }
  } catch (error) {
    console.error('태그 업데이트 오류:', error)
    throw error
  }
}

/**
 * 여행 태그 조회
 * @param {string} travelId - 여행 ID
 * @returns {Promise<Array<string>>} 태그 목록
 */
export async function getTravelTags(travelId) {
  try {
    const { data, error } = await supabase
      .from('travel_tags')
      .select('tag')
      .eq('travel_id', travelId)

    if (error) {
      throw error
    }

    return (data || []).map(t => t.tag)
  } catch (error) {
    console.error('태그 조회 오류:', error)
    throw error
  }
}

// ==================== 감정 태그 관리 ====================

/**
 * 여행 감정 태그 추가
 * @param {string} travelId - 여행 ID
 * @param {Array<string>} emotions - 감정 태그 목록
 * @returns {Promise<void>}
 */
export async function addTravelEmotions(travelId, emotions) {
  if (!emotions || emotions.length === 0) return

  try {
    const emotionData = emotions.map(emotion => ({
      travel_id: travelId,
      emotion: emotion.trim(),
    }))

    const { error } = await supabase
      .from('travel_emotions')
      .upsert(emotionData, { onConflict: 'travel_id,emotion' })

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('감정 태그 추가 오류:', error)
    throw error
  }
}

/**
 * 여행 감정 태그 업데이트
 * @param {string} travelId - 여행 ID
 * @param {Array<string>} emotions - 새로운 감정 태그 목록
 * @returns {Promise<void>}
 */
export async function updateTravelEmotions(travelId, emotions) {
  try {
    // 기존 감정 태그 삭제
    await supabase
      .from('travel_emotions')
      .delete()
      .eq('travel_id', travelId)

    // 새 감정 태그 추가
    if (emotions && emotions.length > 0) {
      await addTravelEmotions(travelId, emotions)
    }
  } catch (error) {
    console.error('감정 태그 업데이트 오류:', error)
    throw error
  }
}

// ==================== 장소 관리 ====================

/**
 * 여행 장소 목록 조회
 * @param {string} travelId - 여행 ID
 * @returns {Promise<Array>} 장소 목록
 */
export async function getTravelPlaces(travelId) {
  try {
    const { data, error } = await supabase
      .from('travel_places')
      .select('*')
      .eq('travel_id', travelId)
      .order('visit_date', { ascending: true })
      .order('visit_time', { ascending: true })

    if (error) {
      throw error
    }

    return (data || []).map(normalizePlace)
  } catch (error) {
    console.error('장소 목록 조회 오류:', error)
    throw error
  }
}

/**
 * 장소 생성
 * @param {Object} placeData - 장소 데이터
 * @returns {Promise<Object>} 생성된 장소
 */
export async function createPlace(placeData) {
  try {
    const { data, error } = await supabase
      .from('travel_places')
      .insert([{
        travel_id: placeData.travelId,
        name: placeData.name.trim(),
        category: placeData.category,
        address: placeData.address || null,
        latitude: placeData.latitude || null,
        longitude: placeData.longitude || null,
        rating: placeData.rating || null,
        memo: placeData.memo || null,
        visit_date: placeData.visitDate || null,
        visit_time: placeData.visitTime || null,
      }])
      .select()
      .single()

    if (error) {
      throw error
    }

    return normalizePlace(data)
  } catch (error) {
    console.error('장소 생성 오류:', error)
    throw error
  }
}

/**
 * 장소 수정
 * @param {string} id - 장소 ID
 * @param {Object} placeData - 수정할 데이터
 * @returns {Promise<Object>} 수정된 장소
 */
export async function updatePlace(id, placeData) {
  try {
    const updateData = {}
    if (placeData.name !== undefined) updateData.name = placeData.name.trim()
    if (placeData.category !== undefined) updateData.category = placeData.category
    if (placeData.address !== undefined) updateData.address = placeData.address
    if (placeData.latitude !== undefined) updateData.latitude = placeData.latitude
    if (placeData.longitude !== undefined) updateData.longitude = placeData.longitude
    if (placeData.rating !== undefined) updateData.rating = placeData.rating
    if (placeData.memo !== undefined) updateData.memo = placeData.memo
    if (placeData.visitDate !== undefined) updateData.visit_date = placeData.visitDate
    if (placeData.visitTime !== undefined) updateData.visit_time = placeData.visitTime

    const { data, error } = await supabase
      .from('travel_places')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return normalizePlace(data)
  } catch (error) {
    console.error('장소 수정 오류:', error)
    throw error
  }
}

/**
 * 장소 삭제
 * @param {string} id - 장소 ID
 * @returns {Promise<void>}
 */
export async function deletePlace(id) {
  try {
    const { error } = await supabase
      .from('travel_places')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('장소 삭제 오류:', error)
    throw error
  }
}

// ==================== 날짜별 기록 관리 ====================

/**
 * 날짜별 기록 조회
 * @param {string} travelId - 여행 ID
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @returns {Promise<Object|null>} 기록
 */
export async function getDateRecord(travelId, date) {
  try {
    const { data, error } = await supabase
      .from('travel_date_records')
      .select('*')
      .eq('travel_id', travelId)
      .eq('record_date', date)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116은 데이터 없음
      throw error
    }

    return data ? normalizeDateRecord(data) : null
  } catch (error) {
    console.error('날짜별 기록 조회 오류:', error)
    throw error
  }
}

/**
 * 날짜별 기록 생성/수정
 * @param {Object} recordData - 기록 데이터
 * @returns {Promise<Object>} 저장된 기록
 */
export async function saveDateRecord(recordData) {
  try {
    const { data, error } = await supabase
      .from('travel_date_records')
      .upsert([{
        travel_id: recordData.travelId,
        record_date: recordData.recordDate,
        content: recordData.content || null,
      }], { onConflict: 'travel_id,record_date' })
      .select()
      .single()

    if (error) {
      throw error
    }

    return normalizeDateRecord(data)
  } catch (error) {
    console.error('날짜별 기록 저장 오류:', error)
    throw error
  }
}

/**
 * 날짜별 기록 삭제
 * @param {string} id - 기록 ID
 * @returns {Promise<void>}
 */
export async function deleteDateRecord(id) {
  try {
    const { error } = await supabase
      .from('travel_date_records')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('날짜별 기록 삭제 오류:', error)
    throw error
  }
}

// ==================== 사진 관리 ====================

/**
 * 여행 사진 목록 조회
 * @param {string} travelId - 여행 ID
 * @param {Object} filters - 필터 (dateRecordId, placeId)
 * @returns {Promise<Array>} 사진 목록
 */
export async function getTravelImages(travelId, filters = {}) {
  try {
    let query = supabase
      .from('travel_images')
      .select('*')
      .eq('travel_id', travelId)

    if (filters.dateRecordId) {
      query = query.eq('date_record_id', filters.dateRecordId)
    }
    if (filters.placeId) {
      query = query.eq('place_id', filters.placeId)
    }

    query = query.order('image_order', { ascending: true })

    const { data, error } = await query

    if (error) {
      throw error
    }

    return (data || []).map(normalizeImage)
  } catch (error) {
    console.error('사진 목록 조회 오류:', error)
    throw error
  }
}

/**
 * 사진 추가
 * @param {Object} imageData - 사진 데이터
 * @returns {Promise<Object>} 추가된 사진
 */
export async function addTravelImage(imageData) {
  try {
    // 대표 사진 설정 시 기존 대표 사진 해제
    if (imageData.isRepresentative) {
      await supabase
        .from('travel_images')
        .update({ is_representative: false })
        .eq('travel_id', imageData.travelId)
        .eq('is_representative', true)
    }

    const { data, error } = await supabase
      .from('travel_images')
      .insert([{
        travel_id: imageData.travelId,
        date_record_id: imageData.dateRecordId || null,
        place_id: imageData.placeId || null,
        image_url: imageData.imageUrl,
        image_order: imageData.imageOrder || 0,
        is_representative: imageData.isRepresentative || false,
        caption: imageData.caption || null,
      }])
      .select()
      .single()

    if (error) {
      throw error
    }

    // 대표 사진이면 여행 정보도 업데이트
    if (imageData.isRepresentative) {
      await supabase
        .from('travels')
        .update({ representative_image_url: imageData.imageUrl })
        .eq('id', imageData.travelId)
    }

    return normalizeImage(data)
  } catch (error) {
    console.error('사진 추가 오류:', error)
    throw error
  }
}

/**
 * 사진 삭제
 * @param {string} id - 사진 ID
 * @returns {Promise<void>}
 */
export async function deleteTravelImage(id) {
  try {
    // 삭제 전에 대표 사진인지 확인
    const { data: image } = await supabase
      .from('travel_images')
      .select('travel_id, is_representative')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('travel_images')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    // 대표 사진이었다면 여행 정보에서도 제거
    if (image && image.is_representative) {
      await supabase
        .from('travels')
        .update({ representative_image_url: null })
        .eq('id', image.travel_id)
    }
  } catch (error) {
    console.error('사진 삭제 오류:', error)
    throw error
  }
}

/**
 * 대표 사진 설정
 * @param {string} imageId - 사진 ID
 * @returns {Promise<void>}
 */
export async function setRepresentativeImage(imageId) {
  try {
    // 사진 정보 조회
    const { data: image, error: imageError } = await supabase
      .from('travel_images')
      .select('travel_id, image_url')
      .eq('id', imageId)
      .single()

    if (imageError) {
      throw imageError
    }

    // 기존 대표 사진 해제
    await supabase
      .from('travel_images')
      .update({ is_representative: false })
      .eq('travel_id', image.travel_id)
      .eq('is_representative', true)

    // 새 대표 사진 설정
    await supabase
      .from('travel_images')
      .update({ is_representative: true })
      .eq('id', imageId)

    // 여행 정보 업데이트
    await supabase
      .from('travels')
      .update({ representative_image_url: image.image_url })
      .eq('id', image.travel_id)
  } catch (error) {
    console.error('대표 사진 설정 오류:', error)
    throw error
  }
}

// ==================== 통계 ====================

/**
 * 연도별 여행 통계
 * @param {number} year - 연도
 * @returns {Promise<Object>} 통계 데이터
 */
export async function getYearlyStatistics(year) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      totalTrips: 0,
      totalDays: 0,
      averageSatisfaction: 0,
    }
  }

  try {
    const { data, error } = await supabase
      .from('travels')
      .select('start_date, end_date, satisfaction_score')
      .eq('user_id', userId)
      .gte('start_date', `${year}-01-01`)
      .lte('end_date', `${year}-12-31`)

    if (error) {
      throw error
    }

    const trips = data || []
    const totalTrips = trips.length
    const totalDays = trips.reduce((sum, trip) => {
      const start = new Date(trip.start_date)
      const end = new Date(trip.end_date)
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
      return sum + days
    }, 0)

    const satisfactionScores = trips
      .map(t => t.satisfaction_score)
      .filter(score => score !== null)
    const averageSatisfaction = satisfactionScores.length > 0
      ? satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length
      : 0

    return {
      totalTrips,
      totalDays,
      averageSatisfaction: Math.round(averageSatisfaction * 10) / 10,
    }
  } catch (error) {
    console.error('연도별 통계 조회 오류:', error)
    throw error
  }
}

/**
 * 지역별 방문 통계
 * @returns {Promise<Object>} 지역별 방문 횟수
 */
export async function getProvinceStatistics() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {}
  }

  try {
    const { data, error } = await supabase
      .from('travels')
      .select('province')
      .eq('user_id', userId)

    if (error) {
      throw error
    }

    const stats = {}
    ;(data || []).forEach(trip => {
      stats[trip.province] = (stats[trip.province] || 0) + 1
    })

    return stats
  } catch (error) {
    console.error('지역별 통계 조회 오류:', error)
    throw error
  }
}

/**
 * 만족도 통계
 * @returns {Promise<Object>} 만족도 분포
 */
export async function getSatisfactionStatistics() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      distribution: {},
      average: 0,
    }
  }

  try {
    const { data, error } = await supabase
      .from('travels')
      .select('satisfaction_score')
      .eq('user_id', userId)
      .not('satisfaction_score', 'is', null)

    if (error) {
      throw error
    }

    const scores = (data || []).map(t => t.satisfaction_score)
    const distribution = {}
    scores.forEach(score => {
      distribution[score] = (distribution[score] || 0) + 1
    })

    const average = scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0

    return {
      distribution,
      average: Math.round(average * 10) / 10,
    }
  } catch (error) {
    console.error('만족도 통계 조회 오류:', error)
    throw error
  }
}
