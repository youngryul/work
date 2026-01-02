import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 데이터베이스 컬럼명을 camelCase로 변환
 */
function normalizeVisitedCountry(country) {
  if (!country) return country
  return {
    ...country,
    countryCode: country.country_code ?? country.countryCode,
    visitedAt: country.visited_at ?? country.visitedAt,
    createdAt: country.created_at ?? country.createdAt,
    updatedAt: country.updated_at ?? country.updatedAt,
  }
}

/**
 * 모든 방문 국가 조회
 * @returns {Promise<Array>} 방문 국가 목록
 */
export async function getAllVisitedCountries() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('visited_countries')
      .select('*')
      .eq('user_id', userId)
      .order('visited_at', { ascending: false })

    if (error) {
      console.error('방문 국가 조회 오류:', error)
      throw error
    }

    return (data || []).map(normalizeVisitedCountry)
  } catch (error) {
    console.error('방문 국가 조회 오류:', error)
    throw error
  }
}

/**
 * 방문 국가 코드 목록만 조회 (Set으로 반환하여 빠른 조회)
 * @returns {Promise<Set<string>>} 방문 국가 코드 Set
 */
export async function getVisitedCountryCodes() {
  const visitedCountries = await getAllVisitedCountries()
  return new Set(visitedCountries.map((country) => country.countryCode?.toUpperCase()))
}

/**
 * 특정 국가 방문 여부 확인
 * @param {string} countryCode - ISO 3166-1 alpha-2 국가 코드
 * @returns {Promise<boolean>} 방문 여부
 */
export async function isCountryVisited(countryCode) {
  if (!countryCode) return false
  
  const userId = await getCurrentUserId()
  if (!userId) {
    return false
  }

  try {
    const { data, error } = await supabase
      .from('visited_countries')
      .select('id')
      .eq('user_id', userId)
      .eq('country_code', countryCode.toUpperCase())
      .maybeSingle()

    if (error) {
      console.error('방문 국가 확인 오류:', error)
      throw error
    }

    return !!data
  } catch (error) {
    console.error('방문 국가 확인 오류:', error)
    throw error
  }
}

/**
 * 방문 국가 추가
 * @param {string} countryCode - ISO 3166-1 alpha-2 국가 코드
 * @returns {Promise<Object>} 생성된 방문 국가
 */
export async function addVisitedCountry(countryCode) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  if (!countryCode) {
    throw new Error('국가 코드가 필요합니다.')
  }

  try {
    // 이미 방문한 국가인지 확인
    const isVisited = await isCountryVisited(countryCode)
    if (isVisited) {
      // 이미 방문한 국가면 기존 데이터 반환
      const { data, error } = await supabase
        .from('visited_countries')
        .select('*')
        .eq('user_id', userId)
        .eq('country_code', countryCode.toUpperCase())
        .maybeSingle()
      
      if (error) {
        console.error('방문 국가 조회 오류:', error)
        throw error
      }
      
      if (!data) {
        throw new Error('방문 국가 데이터를 찾을 수 없습니다.')
      }
      
      return normalizeVisitedCountry(data)
    }

    const newVisitedCountry = {
      country_code: countryCode.toUpperCase(),
      user_id: userId,
      visited_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('visited_countries')
      .insert([newVisitedCountry])
      .select()
      .single()

    if (error) {
      console.error('방문 국가 추가 오류:', error)
      if (error.message.includes('relation "visited_countries" does not exist')) {
        throw new Error('방문 국가 테이블이 생성되지 않았습니다. Supabase SQL Editor에서 supabase-visited-countries-schema.sql을 실행해주세요.')
      }
      throw new Error(`방문 국가 추가 실패: ${error.message || '알 수 없는 오류'}`)
    }

    return normalizeVisitedCountry(data)
  } catch (error) {
    console.error('방문 국가 추가 오류:', error)
    throw error
  }
}

/**
 * 방문 국가 삭제
 * @param {string} countryCode - ISO 3166-1 alpha-2 국가 코드
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
export async function removeVisitedCountry(countryCode) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  if (!countryCode) {
    throw new Error('국가 코드가 필요합니다.')
  }

  try {
    const { error } = await supabase
      .from('visited_countries')
      .delete()
      .eq('user_id', userId)
      .eq('country_code', countryCode.toUpperCase())

    if (error) {
      console.error('방문 국가 삭제 오류:', error)
      throw error
    }

    return true
  } catch (error) {
    console.error('방문 국가 삭제 오류:', error)
    throw error
  }
}

/**
 * 방문 국가 토글 (방문했으면 삭제, 안 했으면 추가)
 * @param {string} countryCode - ISO 3166-1 alpha-2 국가 코드
 * @returns {Promise<boolean>} 토글 후 방문 여부 (true: 방문함, false: 방문 안 함)
 */
export async function toggleVisitedCountry(countryCode) {
  const isVisited = await isCountryVisited(countryCode)
  
  if (isVisited) {
    await removeVisitedCountry(countryCode)
    return false
  } else {
    await addVisitedCountry(countryCode)
    return true
  }
}

