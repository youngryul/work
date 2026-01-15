import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { SYSTEM_CATEGORY_DAILY, SYSTEM_CATEGORY_DAILY_EMOJI } from '../constants/categories.js'

/**
 * 모든 카테고리 조회
 * 카테고리가 없으면 기본 카테고리를 자동 생성합니다.
 * @returns {Promise<Array>} 카테고리 목록 [{ id, name, emoji }]
 */
export async function getCategories() {
  const userId = await getCurrentUserId()
  if (!userId) {
    console.warn('로그인이 필요합니다.')
    return []
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) {
    console.error('카테고리 조회 오류:', error)
    return []
  }

  let categories = (data || []).map((cat) => ({
    id: cat.id,
    name: cat.name,
    emoji: cat.emoji,
  }))

  // 카테고리가 없으면 기본 카테고리 자동 생성
  if (categories.length === 0) {
    try {
      const created = await initializeDefaultCategories()
      if (created) {
        // 생성 후 다시 조회
        const { data: newData, error: newError } = await supabase
          .from('categories')
          .select('*')
          .eq('user_id', userId)
          .order('name', { ascending: true })

        if (!newError && newData) {
          categories = newData.map((cat) => ({
            id: cat.id,
            name: cat.name,
            emoji: cat.emoji,
          }))
        }
      }
    } catch (initError) {
      console.warn('기본 카테고리 자동 생성 실패:', initError)
    }
  }

  // 시스템 카테고리(일상) 추가 (데이터베이스에 없어도 항상 표시)
  const hasSystemCategory = categories.some(cat => cat.name === SYSTEM_CATEGORY_DAILY)
  if (!hasSystemCategory) {
    categories.unshift({
      id: 'system_daily',
      name: SYSTEM_CATEGORY_DAILY,
      emoji: SYSTEM_CATEGORY_DAILY_EMOJI,
    })
  }

  // 사용자가 설정한 기본 카테고리를 맨 앞으로 이동 (일상 제외)
  const defaultCategory = await getDefaultCategory()
  if (defaultCategory !== SYSTEM_CATEGORY_DAILY) {
    const defaultIndex = categories.findIndex(cat => cat.name === defaultCategory)
    if (defaultIndex > 0) {
      const defaultCat = categories[defaultIndex]
      categories.splice(defaultIndex, 1)
      // 일상 다음에 배치
      const systemIndex = categories.findIndex(cat => cat.name === SYSTEM_CATEGORY_DAILY)
      if (systemIndex >= 0) {
        categories.splice(systemIndex + 1, 0, defaultCat)
      } else {
        categories.unshift(defaultCat)
      }
    }
  }

  return categories
}

/**
 * 카테고리 추가
 * @param {string} name - 카테고리 이름
 * @param {string} emoji - 카테고리 이모지
 * @returns {Promise<Object>} 생성된 카테고리
 */
export async function addCategory(name, emoji) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  // 중복 확인 (같은 사용자의 카테고리만 확인)
  const existing = await getCategories()
  if (existing.some((cat) => cat.name === name)) {
    throw new Error('이미 존재하는 카테고리입니다.')
  }

  const newCategory = {
    name: name.trim(),
    emoji: emoji.trim(),
    user_id: userId,
  }

  const { data, error } = await supabase
    .from('categories')
    .insert([newCategory])
    .select()
    .single()

  if (error) {
    console.error('카테고리 추가 오류:', error)
    throw error
  }

  return data
}

/**
 * 카테고리 삭제
 * @param {string} name - 삭제할 카테고리 이름
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
export async function deleteCategory(name) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('name', name)
    .eq('user_id', userId)

  if (error) {
    console.error('카테고리 삭제 오류:', error)
    throw error
  }

  return true
}

/**
 * 카테고리 이름으로 이모지 가져오기
 * @param {string} categoryName - 카테고리 이름
 * @returns {Promise<string>} 이모지
 */
export async function getCategoryEmoji(categoryName) {
  // 시스템 카테고리(일상) 처리
  if (categoryName === SYSTEM_CATEGORY_DAILY) {
    return SYSTEM_CATEGORY_DAILY_EMOJI
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    return '📝'
  }

  const { data, error } = await supabase
    .from('categories')
    .select('emoji')
    .eq('name', categoryName)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return '📝'
  }

  return data.emoji
}

/**
 * 기본 카테고리 가져오기 (사용자가 설정한 기본 카테고리 또는 첫 번째 카테고리)
 * @returns {Promise<string>} 기본 카테고리 이름
 */
export async function getDefaultCategory() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return '회사'
  }

  try {
    // 사용자 설정에서 기본 카테고리 조회
    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('default_category')
      .eq('user_id', userId)
      .maybeSingle()

    // 테이블이 없거나 오류가 발생한 경우 무시하고 계속 진행
    if (error && error.code !== 'PGRST116') {
      // PGRST116은 "no rows returned" 오류로, 정상적인 경우입니다
      // 406 오류는 테이블이 없을 때 발생할 수 있으므로 무시
      if (error.code !== '42P01') {
        console.warn('user_preferences 조회 오류 (무시됨):', error)
      }
    }

    if (!error && preferences && preferences.default_category) {
      // 설정된 기본 카테고리가 존재하는지 확인
      const { data: categories } = await supabase
        .from('categories')
        .select('name')
        .eq('user_id', userId)
      
      if (categories && categories.some(cat => cat.name === preferences.default_category)) {
        return preferences.default_category
      }
    }
  } catch (err) {
    // 테이블이 없거나 다른 오류가 발생한 경우 무시하고 계속 진행
    console.warn('기본 카테고리 조회 중 오류 (무시됨):', err)
  }

  // 설정이 없거나 카테고리가 삭제된 경우, 첫 번째 카테고리 반환
  try {
    const { data: categories } = await supabase
      .from('categories')
      .select('name')
      .eq('user_id', userId)
      .order('name', { ascending: true })
      .limit(1)

    return categories && categories.length > 0 ? categories[0].name : '회사'
  } catch (err) {
    console.warn('카테고리 조회 중 오류:', err)
    return '회사'
  }
}

/**
 * 기본 카테고리 자동 생성 (사용자가 처음 로그인할 때)
 * @returns {Promise<boolean>} 생성 성공 여부
 */
export async function initializeDefaultCategories() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return false
  }

  try {
    // 이미 카테고리가 있는지 확인
    const { data: existing, error: checkError } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (checkError) {
      console.error('카테고리 확인 오류:', checkError)
      return false
    }

    if (existing && existing.length > 0) {
      // 이미 카테고리가 있으면 생성하지 않음
      return false
    }

    // 기본 카테고리 목록 (회사를 맨 앞에 배치)
    const defaultCategories = [
      { name: '회사', emoji: '🏢' },
      { name: '부업', emoji: '💰' },
      { name: '집안일', emoji: '🧹' },
      { name: '프로젝트', emoji: '💻' },
      { name: '운동', emoji: '💪' },
      { name: '공부', emoji: '📚' },
    ]

    // 모든 기본 카테고리 생성
    const categoriesToInsert = defaultCategories.map(cat => ({
      name: cat.name,
      emoji: cat.emoji,
      user_id: userId,
    }))

    const { error } = await supabase
      .from('categories')
      .insert(categoriesToInsert)

    if (error) {
      console.error('기본 카테고리 생성 오류:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('기본 카테고리 초기화 실패:', error)
    return false
  }
}

/**
 * 기본 카테고리 설정
 * @param {string} categoryName - 기본 카테고리 이름
 * @returns {Promise<boolean>} 설정 성공 여부
 */
export async function setDefaultCategory(categoryName) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  // 카테고리가 존재하는지 확인
  const { data: categories } = await supabase
    .from('categories')
    .select('name')
    .eq('user_id', userId)
  
  if (!categories || !categories.some(cat => cat.name === categoryName)) {
    throw new Error('존재하지 않는 카테고리입니다.')
  }

  try {
    // 기존 설정 확인
    const { data: existing, error: checkError } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    // 테이블이 없거나 오류가 발생한 경우 새로 생성
    if (checkError && checkError.code !== 'PGRST116') {
      // 42P01은 테이블이 없을 때 발생하는 오류
      if (checkError.code === '42P01') {
        throw new Error('user_preferences 테이블이 생성되지 않았습니다. Supabase에서 테이블을 생성해주세요.')
      }
      console.error('user_preferences 확인 오류:', checkError)
      throw checkError
    }

    if (existing) {
      // 업데이트
      const { error } = await supabase
        .from('user_preferences')
        .update({ default_category: categoryName })
        .eq('user_id', userId)

      if (error) {
        console.error('기본 카테고리 설정 오류:', error)
        throw error
      }
    } else {
      // 새로 생성
      const { error } = await supabase
        .from('user_preferences')
        .insert({ user_id: userId, default_category: categoryName })

      if (error) {
        console.error('기본 카테고리 설정 오류:', error)
        throw error
      }
    }

    return true
  } catch (err) {
    // 테이블이 없는 경우 명확한 오류 메시지
    if (err.message && err.message.includes('테이블이 생성되지 않았습니다')) {
      throw err
    }
    console.error('기본 카테고리 설정 중 오류:', err)
    throw new Error('기본 카테고리 설정에 실패했습니다. user_preferences 테이블이 생성되었는지 확인해주세요.')
  }
}
