import { supabase } from '../config/supabase.js'

/**
 * 연간 회고록 데이터 조회
 * @param {string} year - 연도 (예: '2025')
 * @returns {Promise<Object|null>} 회고록 데이터
 */
export async function getAnnualReview(year = '2025') {
  const { data, error } = await supabase
    .from('annual_review')
    .select('*')
    .eq('year', year)
    .maybeSingle()

  if (error) {
    console.error('회고록 조회 오류:', error)
    return null
  }

  if (!data) {
    return null
  }

  try {
    return {
      id: data.id,
      year: data.year,
      reviewData: JSON.parse(data.reviewdata),
      completedDays: JSON.parse(data.completeddays),
      createdAt: data.createdat,
      updatedAt: data.updatedat,
    }
  } catch (parseError) {
    console.error('회고록 데이터 파싱 오류:', parseError)
    return null
  }
}

/**
 * 연간 회고록 데이터 저장
 * @param {string} year - 연도 (예: '2025')
 * @param {Object} reviewData - 회고록 데이터
 * @param {Array<number>} completedDays - 완료된 Day 배열
 * @returns {Promise<Object|null>} 저장된 회고록 데이터
 */
export async function saveAnnualReview(year = '2025', reviewData, completedDays) {
  try {
    // 기존 데이터 확인
    const existing = await getAnnualReview(year)

    const reviewDataJson = JSON.stringify(reviewData)
    const completedDaysJson = JSON.stringify(completedDays)
    const now = Date.now()

    if (existing) {
      // 업데이트
      const { data, error } = await supabase
        .from('annual_review')
        .update({
          reviewdata: reviewDataJson,
          completeddays: completedDaysJson,
          updatedat: now,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('회고록 업데이트 오류:', error)
        throw error
      }

      return {
        id: data.id,
        year: data.year,
        reviewData: JSON.parse(data.reviewdata),
        completedDays: JSON.parse(data.completeddays),
        createdAt: data.createdat,
        updatedAt: data.updatedat,
      }
    } else {
      // 생성
      const { data, error } = await supabase
        .from('annual_review')
        .insert({
          year,
          reviewdata: reviewDataJson,
          completeddays: completedDaysJson,
          createdat: now,
          updatedat: now,
        })
        .select()
        .single()

      if (error) {
        console.error('회고록 생성 오류:', error)
        throw error
      }

      return {
        id: data.id,
        year: data.year,
        reviewData: JSON.parse(data.reviewdata),
        completedDays: JSON.parse(data.completeddays),
        createdAt: data.createdat,
        updatedAt: data.updatedat,
      }
    }
  } catch (error) {
    console.error('회고록 저장 오류:', error)
    throw error
  }
}


