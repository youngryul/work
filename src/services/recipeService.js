import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import {
  assertSufficientTokensForRecipeImageGeneration,
  consumeTokensForRecipeImageGeneration,
} from './aiTokenService.js'
import { generateRecipeImage } from './aiImageService.js'
import { uploadImageFromUrl } from './imageService.js'
import { awardJellyForRecipeCreate } from './jellyService.js'

/**
 * @param {Array} rows
 * @returns {Array}
 */
function mapIngredientRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    catalog: row.recipe_ingredient_catalog || null,
  }))
}

/**
 * 레시피 목록 (재료 포함)
 * @returns {Promise<Array>}
 */
export async function getRecipes() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients (
        id,
        catalog_id,
        custom_name,
        quantity,
        note,
        sort_order,
        recipe_ingredient_catalog (
          id,
          name,
          category,
          emoji,
          image_url
        )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data || []).map((recipe) => ({
    ...recipe,
    ingredients: mapIngredientRows(
      [...(recipe.recipe_ingredients || [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
    ),
  }))
}

/**
 * 레시피 단건
 * @param {string} recipeId
 * @returns {Promise<Object|null>}
 */
export async function getRecipeById(recipeId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients (
        id,
        catalog_id,
        custom_name,
        quantity,
        note,
        sort_order,
        recipe_ingredient_catalog (
          id,
          name,
          category,
          emoji,
          image_url
        )
      )
    `)
    .eq('id', recipeId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...data,
    ingredients: mapIngredientRows(
      [...(data.recipe_ingredients || [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
    ),
  }
}

/**
 * 요리 제목으로 AI 이미지 생성 (토큰 차감 + Storage 업로드)
 * @param {string} title
 * @returns {Promise<{ imageUrl: string, imagePrompt: string, remainingBalance: number }>}
 */
export async function generateRecipeCoverImage(title) {
  await assertSufficientTokensForRecipeImageGeneration()
  const { imageUrl: generatedUrl, prompt } = await generateRecipeImage(title)

  let imageUrl = generatedUrl
  try {
    const fileName = `recipe-${Date.now()}.png`
    const permanentUrl = await uploadImageFromUrl(generatedUrl, 'recipes', fileName)
    if (permanentUrl && permanentUrl !== generatedUrl) {
      imageUrl = permanentUrl
    }
  } catch (uploadError) {
    console.error('레시피 이미지 업로드 실패, 임시 URL 사용:', uploadError)
  }

  const remainingBalance = await consumeTokensForRecipeImageGeneration()
  return {
    imageUrl,
    imagePrompt: prompt,
    remainingBalance,
  }
}

/**
 * @param {Array<{ catalogId?: string|null, customName?: string|null, quantity?: number, note?: string|null, sortOrder?: number }>} ingredients
 * @returns {Array}
 */
function toIngredientInsertRows(recipeId, ingredients) {
  return (ingredients || [])
    .map((item, index) => {
      const customName = item.customName?.trim() || null
      const catalogId = item.catalogId || null
      if (!catalogId && !customName) return null
      const quantity = Number(item.quantity)
      return {
        recipe_id: recipeId,
        catalog_id: catalogId,
        custom_name: customName,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        note: item.note?.trim() || null,
        sort_order: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
      }
    })
    .filter(Boolean)
}

/**
 * 레시피 재료 전체 교체
 * @param {string} recipeId
 * @param {Array} ingredients
 */
async function replaceRecipeIngredients(recipeId, ingredients) {
  const { error: deleteError } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('recipe_id', recipeId)

  if (deleteError) throw deleteError

  const rows = toIngredientInsertRows(recipeId, ingredients)
  if (rows.length === 0) return

  const { error: insertError } = await supabase
    .from('recipe_ingredients')
    .insert(rows)

  if (insertError) throw insertError
}

/**
 * 레시피 생성
 * @param {{ title: string, instructions?: string, imageUrl?: string|null, imagePrompt?: string|null, ingredients?: Array }} input
 * @returns {Promise<Object>}
 */
export async function createRecipe(input) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const title = (input.title || '').trim()
  if (!title) throw new Error('요리 제목을 입력해주세요.')

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      user_id: userId,
      title,
      instructions: input.instructions?.trim() || '',
      image_url: input.imageUrl || null,
      image_prompt: input.imagePrompt || null,
    })
    .select()
    .single()

  if (error) throw error

  await replaceRecipeIngredients(data.id, input.ingredients || [])

  let jellyAwarded = 0
  try {
    const jellyResult = await awardJellyForRecipeCreate(data.id)
    jellyAwarded = jellyResult?.awarded ?? 0
  } catch (jellyError) {
    console.error('젤리 지급 실패:', jellyError)
  }

  const recipe = await getRecipeById(data.id)
  return { ...recipe, jellyAwarded }
}

/**
 * 레시피 수정
 * @param {string} recipeId
 * @param {{ title?: string, instructions?: string, imageUrl?: string|null, imagePrompt?: string|null, ingredients?: Array }} updates
 * @returns {Promise<Object>}
 */
export async function updateRecipe(recipeId, updates) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const payload = {
    updated_at: new Date().toISOString(),
  }
  if (typeof updates.title === 'string') {
    payload.title = updates.title.trim()
  }
  if (typeof updates.instructions === 'string') {
    payload.instructions = updates.instructions.trim()
  }
  if (updates.imageUrl !== undefined) {
    payload.image_url = updates.imageUrl
  }
  if (updates.imagePrompt !== undefined) {
    payload.image_prompt = updates.imagePrompt
  }

  const { error } = await supabase
    .from('recipes')
    .update(payload)
    .eq('id', recipeId)
    .eq('user_id', userId)

  if (error) throw error

  if (updates.ingredients) {
    await replaceRecipeIngredients(recipeId, updates.ingredients)
  }

  return getRecipeById(recipeId)
}

/**
 * 레시피 삭제
 * @param {string} recipeId
 * @returns {Promise<void>}
 */
export async function deleteRecipe(recipeId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId)
    .eq('user_id', userId)

  if (error) throw error
}
