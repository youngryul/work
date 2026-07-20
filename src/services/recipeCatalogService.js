import { supabase } from '../config/supabase.js'
import {
  normalizeRecipeIngredientName,
  recipeIngredientCatalogKey,
} from '../constants/recipe.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { isAdmin } from './adminService.js'
import { uploadImage } from './imageService.js'

/**
 * 전체 사용자 공용 재료 카탈로그 조회
 * @param {{ category?: string }} [options]
 * @returns {Promise<Array>}
 */
export async function getRecipeCatalog(options = {}) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  let query = supabase
    .from('recipe_ingredient_catalog')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (options.category) {
    query = query.eq('category', options.category)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * 동일 이름·카테고리 재료 존재 여부
 * @param {string} name
 * @param {string} category
 * @param {Array} [catalog]
 * @returns {Promise<boolean>}
 */
export async function catalogIngredientExists(name, category, catalog = null) {
  const normalized = normalizeRecipeIngredientName(name)
  if (!normalized || !category) return false

  const list = catalog ?? (await getRecipeCatalog())
  return list.some(
    (item) =>
      item.category === category &&
      normalizeRecipeIngredientName(item.name) === normalized,
  )
}

async function assertAdminForCatalogImage() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')
  const admin = await isAdmin(userId)
  if (!admin) {
    throw new Error('재료 이미지는 관리자만 등록할 수 있습니다.')
  }
}

/**
 * 공용 재료 추가 (전체 사용자에게 표시)
 * @param {{ name: string, category: string, emoji?: string, imageFile?: File|null, sortOrder?: number }} input
 * @returns {Promise<Object>}
 */
export async function createCatalogIngredient(input) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const name = (input.name || '').trim()
  if (!name) throw new Error('재료 이름을 입력해주세요.')
  if (!input.category) throw new Error('카테고리를 선택해주세요.')

  if (await catalogIngredientExists(name, input.category)) {
    throw new Error('같은 카테고리에 동일한 재료가 이미 있습니다.')
  }

  let imageUrl = null
  if (input.imageFile) {
    await assertAdminForCatalogImage()
    imageUrl = await uploadImage(input.imageFile, 'recipe-ingredients')
  }

  const { data, error } = await supabase
    .from('recipe_ingredient_catalog')
    .insert({
      user_id: null,
      name,
      category: input.category,
      emoji: (input.emoji || '🥗').trim() || '🥗',
      image_url: imageUrl,
      sort_order: Number.isFinite(input.sortOrder) ? input.sortOrder : 500,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('같은 카테고리에 동일한 재료가 이미 있습니다.')
    }
    throw error
  }
  return data
}

/**
 * 관리자: 재료 정보·이미지 수정
 * @param {string} catalogId
 * @param {{ name?: string, emoji?: string, category?: string, imageFile?: File|null, clearImage?: boolean }} updates
 * @returns {Promise<Object>}
 */
export async function updateCatalogIngredient(catalogId, updates) {
  await assertAdminForCatalogImage()

  const payload = {
    updated_at: new Date().toISOString(),
  }
  if (typeof updates.name === 'string') {
    payload.name = updates.name.trim()
  }
  if (typeof updates.emoji === 'string') {
    payload.emoji = updates.emoji.trim() || '🥗'
  }
  if (typeof updates.category === 'string') {
    payload.category = updates.category
  }
  if (updates.imageFile) {
    payload.image_url = await uploadImage(updates.imageFile, 'recipe-ingredients')
  } else if (updates.clearImage) {
    payload.image_url = null
  }

  if (payload.name && payload.category) {
    const catalog = await getRecipeCatalog()
    const key = recipeIngredientCatalogKey(payload.name, payload.category)
    const duplicate = catalog.some(
      (item) =>
        item.id !== catalogId &&
        recipeIngredientCatalogKey(item.name, item.category) === key,
    )
    if (duplicate) {
      throw new Error('같은 카테고리에 동일한 재료가 이미 있습니다.')
    }
  }

  const { data, error } = await supabase
    .from('recipe_ingredient_catalog')
    .update(payload)
    .eq('id', catalogId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('같은 카테고리에 동일한 재료가 이미 있습니다.')
    }
    throw error
  }
  return data
}

/**
 * 관리자: 재료 삭제
 * @param {string} catalogId
 * @returns {Promise<void>}
 */
export async function deleteCatalogIngredient(catalogId) {
  await assertAdminForCatalogImage()

  const { error } = await supabase
    .from('recipe_ingredient_catalog')
    .delete()
    .eq('id', catalogId)

  if (error) throw error
}

/**
 * 관리자: 재료 이미지만 등록·교체
 * @param {string} catalogId
 * @param {File} imageFile
 * @returns {Promise<Object>}
 */
export async function uploadCatalogIngredientImage(catalogId, imageFile) {
  if (!imageFile) throw new Error('이미지 파일을 선택해주세요.')
  return updateCatalogIngredient(catalogId, { imageFile })
}
