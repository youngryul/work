/**
 * 농장 경험치 이벤트 관리 서비스 (관리자)
 */
import { supabase } from '../config/supabase.js'
import { isAdmin } from './adminService.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * @param {Object} row
 */
function normalizeFarmXpEvent(row) {
  return {
    id: row.id,
    eventKey: row.event_key,
    label: row.label,
    description: row.description || '',
    xpAmount: row.xp_amount,
    jellyCost: row.jelly_cost,
    minStage: row.min_stage,
    maxStage: row.max_stage,
    triggerType: row.trigger_type,
    farmArea: row.farm_area,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {Object} row
 */
function normalizeFarmSetting(row) {
  return {
    key: row.key,
    value: row.value,
    label: row.label,
    updatedAt: row.updated_at,
  }
}

async function assertAdmin() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')
  const admin = await isAdmin(userId)
  if (!admin) throw new Error('관리자 권한이 필요합니다.')
}

/**
 * @returns {Promise<Array>}
 */
export async function getAllFarmXpEvents() {
  await assertAdmin()

  const { data, error } = await supabase
    .from('farm_xp_events')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data || []).map(normalizeFarmXpEvent)
}

/**
 * @param {Object} eventData
 * @returns {Promise<Object>}
 */
export async function createFarmXpEvent(eventData) {
  await assertAdmin()

  const { data, error } = await supabase
    .from('farm_xp_events')
    .insert({
      event_key: eventData.eventKey,
      label: eventData.label,
      description: eventData.description || null,
      xp_amount: eventData.xpAmount,
      jelly_cost: eventData.jellyCost ?? 0,
      min_stage: eventData.minStage ?? 1,
      max_stage: eventData.maxStage ?? null,
      trigger_type: eventData.triggerType ?? 'auto',
      farm_area: eventData.farmArea || null,
      is_active: eventData.isActive ?? true,
      sort_order: eventData.sortOrder ?? 0,
    })
    .select()
    .single()

  if (error) throw error
  return normalizeFarmXpEvent(data)
}

/**
 * @param {string} id
 * @param {Object} eventData
 * @returns {Promise<Object>}
 */
export async function updateFarmXpEvent(id, eventData) {
  await assertAdmin()

  const { data, error } = await supabase
    .from('farm_xp_events')
    .update({
      event_key: eventData.eventKey,
      label: eventData.label,
      description: eventData.description || null,
      xp_amount: eventData.xpAmount,
      jelly_cost: eventData.jellyCost ?? 0,
      min_stage: eventData.minStage ?? 1,
      max_stage: eventData.maxStage ?? null,
      trigger_type: eventData.triggerType ?? 'auto',
      farm_area: eventData.farmArea || null,
      is_active: eventData.isActive ?? true,
      sort_order: eventData.sortOrder ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return normalizeFarmXpEvent(data)
}

/**
 * @param {string} id
 */
export async function deleteFarmXpEvent(id) {
  await assertAdmin()

  const { error } = await supabase.from('farm_xp_events').delete().eq('id', id)
  if (error) throw error
}

/**
 * @returns {Promise<Array>}
 */
export async function getAllFarmSettings() {
  await assertAdmin()

  const { data, error } = await supabase
    .from('farm_settings')
    .select('*')
    .order('key', { ascending: true })

  if (error) throw error
  return (data || []).map(normalizeFarmSetting)
}

/**
 * @param {string} key
 * @param {string} value
 * @returns {Promise<Object>}
 */
export async function updateFarmSetting(key, value) {
  await assertAdmin()

  const { data, error } = await supabase
    .from('farm_settings')
    .update({
      value,
      updated_at: new Date().toISOString(),
    })
    .eq('key', key)
    .select()
    .single()

  if (error) throw error
  return normalizeFarmSetting(data)
}
