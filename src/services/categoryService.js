import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

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

  const categories = (data || []).map((cat) => ({
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
          return newData.map((cat) => ({
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
 * 기본 카테고리 가져오기 (첫 번째 카테고리)
 * @returns {Promise<string>} 기본 카테고리 이름
 */
export async function getDefaultCategory() {
  const categories = await getCategories()
  return categories.length > 0 ? categories[0].name : '작업'
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

    // 기본 카테고리 목록
    const defaultCategories = [
      { name: '부업', emoji: '💰' },
      { name: '집안일', emoji: '🧹' },
      { name: '회사', emoji: '🏢' },
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

