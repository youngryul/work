import { supabase } from '../config/supabase.js'
import { BUCKETLIST_STATUS } from '../constants/bucketlistConstants.js'

/**
 * 데이터베이스 컬럼명을 camelCase로 변환
 */
function normalizeBucketlist(bucketlist) {
  if (!bucketlist) return bucketlist
  return {
    ...bucketlist,
    targetDate: bucketlist.target_date ?? bucketlist.targetDate,
    completedAt: bucketlist.completed_at ?? bucketlist.completedAt,
    createdAt: bucketlist.created_at ?? bucketlist.createdAt,
    updatedAt: bucketlist.updated_at ?? bucketlist.updatedAt,
  }
}

/**
 * 모든 버킷리스트 조회
 * @param {string} status - 필터링할 상태 (선택사항)
 * @returns {Promise<Array>} 버킷리스트 목록
 */
export async function getAllBucketlists(status = null) {
  try {
    let query = supabase
      .from('bucketlists')
      .select('*')
      .order('created_at', { ascending: true })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('버킷리스트 조회 오류:', error)
      throw error
    }

    return (data || []).map(normalizeBucketlist)
  } catch (error) {
    console.error('버킷리스트 조회 오류:', error)
    throw error
  }
}

/**
 * 버킷리스트 상세 조회
 * @param {string} id - 버킷리스트 ID
 * @returns {Promise<Object|null>} 버킷리스트
 */
export async function getBucketlistById(id) {
  try {
    const { data, error } = await supabase
      .from('bucketlists')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('버킷리스트 조회 오류:', error)
      throw error
    }

    return normalizeBucketlist(data)
  } catch (error) {
    console.error('버킷리스트 조회 오류:', error)
    throw error
  }
}

/**
 * 버킷리스트 생성
 * @param {Object} bucketlistData - 버킷리스트 데이터
 * @returns {Promise<Object>} 생성된 버킷리스트
 */
export async function createBucketlist(bucketlistData) {
  try {
    const newBucketlist = {
      title: bucketlistData.title.trim(),
      status: bucketlistData.status || BUCKETLIST_STATUS.NOT_COMPLETED,
      target_date: bucketlistData.targetDate || null,
    }

    const { data, error } = await supabase
      .from('bucketlists')
      .insert([newBucketlist])
      .select()
      .single()

    if (error) {
      console.error('버킷리스트 생성 오류:', error)
      // 더 명확한 에러 메시지 제공
      if (error.message) {
        if (error.message.includes('violates check constraint') || error.message.includes('status')) {
          throw new Error('상태 값이 올바르지 않습니다. 데이터베이스 스키마를 업데이트해주세요. (supabase-bucketlist-schema-update.sql 실행)')
        }
        if (error.message.includes('relation "bucketlists" does not exist')) {
          throw new Error('버킷리스트 테이블이 생성되지 않았습니다. Supabase SQL Editor에서 supabase-bucketlist-schema.sql을 실행해주세요.')
        }
      }
      throw new Error(`버킷리스트 생성 실패: ${error.message || '알 수 없는 오류'}`)
    }

    return normalizeBucketlist(data)
  } catch (error) {
    console.error('버킷리스트 생성 오류:', error)
    // 이미 처리된 에러는 그대로 throw
    if (error.message && (error.message.includes('스키마') || error.message.includes('테이블'))) {
      throw error
    }
    throw error
  }
}

/**
 * 버킷리스트 수정
 * @param {string} id - 버킷리스트 ID
 * @param {Object} updates - 수정할 필드
 * @returns {Promise<Object>} 수정된 버킷리스트
 */
export async function updateBucketlist(id, updates) {
  try {
    const dbUpdates = {}

    if ('title' in updates) dbUpdates.title = updates.title.trim()
    if ('status' in updates) {
      dbUpdates.status = updates.status
      // 완료 상태로 변경 시 completed_at 설정
      if (updates.status === BUCKETLIST_STATUS.COMPLETED && !updates.completedAt) {
        dbUpdates.completed_at = new Date().toISOString()
      }
      // 완료 상태가 아닐 때 completed_at 초기화
      if (updates.status !== BUCKETLIST_STATUS.COMPLETED) {
        dbUpdates.completed_at = null
      }
    }
    if ('targetDate' in updates) dbUpdates.target_date = updates.targetDate || null
    if ('completedAt' in updates) dbUpdates.completed_at = updates.completedAt || null

    const { data, error } = await supabase
      .from('bucketlists')
      .update(dbUpdates)
      .select()
      .eq('id', id)
      .single()

    if (error) {
      console.error('버킷리스트 수정 오류:', error)
      throw error
    }

    return normalizeBucketlist(data)
  } catch (error) {
    console.error('버킷리스트 수정 오류:', error)
    throw error
  }
}

/**
 * 버킷리스트 삭제
 * @param {string} id - 버킷리스트 ID
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
export async function deleteBucketlist(id) {
  try {
    const { error } = await supabase
      .from('bucketlists')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('버킷리스트 삭제 오류:', error)
      throw error
    }

    return true
  } catch (error) {
    console.error('버킷리스트 삭제 오류:', error)
    throw error
  }
}

/**
 * 올해 완료한 버킷리스트 조회
 * @param {number} year - 연도 (기본값: 현재 연도)
 * @returns {Promise<Array>} 완료한 버킷리스트 목록
 */
export async function getCompletedBucketlistsByYear(year = new Date().getFullYear()) {
  try {
    const startDate = new Date(year, 0, 1).toISOString()
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999).toISOString()

    const { data, error } = await supabase
      .from('bucketlists')
      .select('*')
      .eq('status', BUCKETLIST_STATUS.COMPLETED)
      .not('completed_at', 'is', null)
      .gte('completed_at', startDate)
      .lte('completed_at', endDate)
      .order('completed_at', { ascending: false })

    if (error) {
      console.error('완료한 버킷리스트 조회 오류:', error)
      throw error
    }

    return (data || []).map(normalizeBucketlist)
  } catch (error) {
    console.error('완료한 버킷리스트 조회 오류:', error)
    throw error
  }
}

/**
 * 카테고리별 달성률 조회
 * @param {number} year - 연도 (기본값: 현재 연도)
 * @returns {Promise<Object>} 카테고리별 달성률 { category: { total, completed, percentage } }
 */
/**
 * 카테고리별 달성률 조회 (카테고리 컬럼 제거로 인해 빈 객체 반환)
 * @param {number} year - 연도 (기본값: 현재 연도)
 * @returns {Promise<Object>} 빈 객체 (카테고리 기능 제거됨)
 */
export async function getCategoryAchievementRate(year = new Date().getFullYear()) {
  // 카테고리 컬럼이 제거되었으므로 빈 객체 반환
  return {}
}

/**
 * 월별 완료 타임라인 조회
 * @param {number} year - 연도 (기본값: 현재 연도)
 * @returns {Promise<Object>} 월별 완료 개수 { 'YYYY-MM': count }
 */
export async function getMonthlyCompletionTimeline(year = new Date().getFullYear()) {
  try {
    const startDate = new Date(year, 0, 1).toISOString()
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999).toISOString()

    const { data, error } = await supabase
      .from('bucketlists')
      .select('completed_at')
      .eq('status', BUCKETLIST_STATUS.COMPLETED)
      .not('completed_at', 'is', null)
      .gte('completed_at', startDate)
      .lte('completed_at', endDate)

    if (error) {
      console.error('월별 완료 타임라인 조회 오류:', error)
      throw error
    }

    // 월별로 그룹화
    const monthlyCounts = {}
    data.forEach((item) => {
      const date = new Date(item.completed_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1
    })

    return monthlyCounts
  } catch (error) {
    console.error('월별 완료 타임라인 조회 오류:', error)
    throw error
  }
}

/**
 * 버킷리스트 회고 저장
 * @param {string} bucketlistId - 버킷리스트 ID
 * @param {string} reflectionText - 회고 내용
 * @param {number} achievementScore - 성취감 점수 (1-10)
 * @returns {Promise<Object>} 저장된 회고
 */
export async function saveBucketlistReflection(bucketlistId, reflectionText, achievementScore) {
  try {
    // 기존 회고가 있으면 업데이트, 없으면 생성
    const { data: existing } = await supabase
      .from('bucketlist_reflections')
      .select('id')
      .eq('bucketlist_id', bucketlistId)
      .single()

    const reflectionData = {
      bucketlist_id: bucketlistId,
      reflection_text: reflectionText.trim(),
      achievement_score: achievementScore,
    }

    let data, error
    if (existing) {
      const result = await supabase
        .from('bucketlist_reflections')
        .update(reflectionData)
        .eq('id', existing.id)
        .select()
        .single()
      data = result.data
      error = result.error
    } else {
      const result = await supabase
        .from('bucketlist_reflections')
        .insert([reflectionData])
        .select()
        .single()
      data = result.data
      error = result.error
    }

    if (error) {
      console.error('회고 저장 오류:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('회고 저장 오류:', error)
    throw error
  }
}

/**
 * 버킷리스트 회고 조회
 * @param {string} bucketlistId - 버킷리스트 ID
 * @returns {Promise<Object|null>} 회고 데이터
 */
export async function getBucketlistReflection(bucketlistId) {
  try {
    const { data, error } = await supabase
      .from('bucketlist_reflections')
      .select('*')
      .eq('bucketlist_id', bucketlistId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116은 데이터가 없을 때 발생하는 에러
      console.error('회고 조회 오류:', error)
      throw error
    }

    return data || null
  } catch (error) {
    console.error('회고 조회 오류:', error)
    throw error
  }
}

