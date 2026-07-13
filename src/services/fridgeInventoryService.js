import { supabase } from '../config/supabase.js'
import { FRIDGE_STATUSES } from '../constants/fridgeInventory.js'

/**
 * 냉장고 상품 목록 조회
 * @param {Object} [options]
 * @param {string} [options.zone] - fridge | freezer | pantry
 * @param {string} [options.status] - active | completed | discarded
 * @returns {Promise<Array>}
 */
export async function getFridgeItems(options = {}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  let query = supabase
    .from('fridge_items')
    .select('*')
    .eq('user_id', user.id)
    .order('expires_at', { ascending: true, nullsFirst: false })
    .order('registered_at', { ascending: false })

  if (options.zone) {
    query = query.eq('zone', options.zone)
  }
  if (options.status) {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * 냉장고 상품 추가
 * @param {Object} itemData
 * @param {string} itemData.zone
 * @param {string} itemData.name
 * @param {number} [itemData.quantity=1]
 * @param {string} [itemData.status]
 * @param {string} itemData.registered_at - YYYY-MM-DD
 * @param {string|null} [itemData.expires_at] - YYYY-MM-DD
 * @returns {Promise<Object>}
 */
export async function createFridgeItem(itemData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const quantity = Number(itemData.quantity)
  const { data, error } = await supabase
    .from('fridge_items')
    .insert({
      user_id: user.id,
      zone: itemData.zone,
      name: itemData.name.trim(),
      quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
      status: itemData.status || FRIDGE_STATUSES.ACTIVE,
      registered_at: itemData.registered_at,
      expires_at: itemData.expires_at || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 냉장고 상품 수정
 * @param {string} itemId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateFridgeItem(itemId, updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  }
  if (typeof payload.name === 'string') {
    payload.name = payload.name.trim()
  }
  if (payload.quantity != null) {
    const quantity = Number(payload.quantity)
    payload.quantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1
  }
  if (payload.expires_at === '') {
    payload.expires_at = null
  }

  const { data, error } = await supabase
    .from('fridge_items')
    .update(payload)
    .eq('id', itemId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 냉장고 상품 상태 변경
 * @param {string} itemId
 * @param {'active'|'completed'|'discarded'} status
 * @returns {Promise<Object>}
 */
export async function updateFridgeItemStatus(itemId, status) {
  return updateFridgeItem(itemId, { status })
}

/**
 * 냉장고 상품 삭제
 * @param {string} itemId
 * @returns {Promise<void>}
 */
export async function deleteFridgeItem(itemId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('fridge_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', user.id)

  if (error) throw error
}
