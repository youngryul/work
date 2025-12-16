import { supabase } from '../config/supabase.js'

/**
 * 모든 카테고리 조회
 * @returns {Promise<Array>} 카테고리 목록 [{ id, name, emoji }]
 */
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('카테고리 조회 오류:', error)
    return []
  }

  return (data || []).map((cat) => ({
    id: cat.id,
    name: cat.name,
    emoji: cat.emoji,
  }))
}

/**
 * 카테고리 추가
 * @param {string} name - 카테고리 이름
 * @param {string} emoji - 카테고리 이모지
 * @returns {Promise<Object>} 생성된 카테고리
 */
export async function addCategory(name, emoji) {
  // 중복 확인
  const existing = await getCategories()
  if (existing.some((cat) => cat.name === name)) {
    throw new Error('이미 존재하는 카테고리입니다.')
  }

  const newCategory = {
    name: name.trim(),
    emoji: emoji.trim(),
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
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('name', name)

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
  const { data, error } = await supabase
    .from('categories')
    .select('emoji')
    .eq('name', categoryName)
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

