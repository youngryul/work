/**
 * 포실이 농장 서비스
 */
import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { FARM_MAX_STAGE, FARM_MILK_EVENT_KEY } from '../constants/farm.js'
import { notifyJellyUpdated } from '../utils/jellyEvents.js'

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
 * @param {Object|null|undefined} data
 */
function normalizeActiveCharacter(data) {
  if (!data) return null
  return {
    characterId: data.characterId,
    name: data.name,
    grade: data.grade,
    imageUrl: data.imageUrl,
  }
}

/**
 * @returns {Promise<Object>}
 */
export async function getMyFarmProgress() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      stage: 1,
      xp: 0,
      farmUnlocked: false,
      nextStageXpRequired: 100,
      maxStage: FARM_MAX_STAGE,
      seedCount: 0,
      feedJellyCost: 3,
      gachaPullJellyCost: 10,
      gachaUnlocked: false,
      activeCharacter: null,
    }
  }

  try {
    const { data, error } = await supabase.rpc('get_my_farm_progress')
    if (error) throw error
    return {
      stage: data?.stage ?? 1,
      xp: data?.xp ?? 0,
      farmUnlocked: Boolean(data?.farmUnlocked),
      nextStageXpRequired: data?.nextStageXpRequired ?? 100,
      maxStage: data?.maxStage ?? FARM_MAX_STAGE,
      seedCount: data?.seedCount ?? 0,
      feedJellyCost: data?.feedJellyCost ?? 3,
      gachaPullJellyCost: data?.gachaPullJellyCost ?? 10,
      gachaUnlocked: Boolean(data?.gachaUnlocked),
      activeCharacter: normalizeActiveCharacter(data?.activeCharacter),
    }
  } catch (error) {
    console.error('농장 진행 조회 실패:', error)
    return {
      stage: 1,
      xp: 0,
      farmUnlocked: false,
      nextStageXpRequired: 100,
      maxStage: FARM_MAX_STAGE,
      seedCount: 0,
      feedJellyCost: 3,
      gachaPullJellyCost: 10,
      gachaUnlocked: false,
      activeCharacter: null,
    }
  }
}

/**
 * 분유 먹이기 이벤트 조회
 * @returns {Promise<Object|null>}
 */
export async function getMilkFeedEvent() {
  const { data, error } = await supabase
    .from('farm_xp_events')
    .select('*')
    .eq('event_key', FARM_MILK_EVENT_KEY)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('분유 이벤트 조회 실패:', error)
    return null
  }

  return data ? normalizeFarmXpEvent(data) : null
}

/**
 * 농장 설정 조회
 * @returns {Promise<Record<string, string>>}
 */
export async function getFarmSettingsMap() {
  const { data, error } = await supabase.from('farm_settings').select('key, value')

  if (error) {
    console.error('농장 설정 조회 실패:', error)
    return {}
  }

  return Object.fromEntries((data || []).map((row) => [row.key, row.value]))
}

/**
 * 농장 경험치 이벤트 처리
 * @param {string} eventKey
 * @param {string} [idempotencyKey]
 * @returns {Promise<Object|null>}
 */
export async function processFarmXpEvent(eventKey, idempotencyKey = null) {
  const userId = await getCurrentUserId()
  if (!userId || !eventKey) return null

  const { data, error } = await supabase.rpc('process_farm_xp_event', {
    p_event_key: eventKey,
    p_idempotency_key: idempotencyKey,
  })

  if (error) {
    console.error('농장 이벤트 처리 오류:', error)
    throw error
  }

  if (data?.jellySpent > 0) {
    notifyJellyUpdated({ balance: null, awarded: -data.jellySpent })
  }

  return data
}

/**
 * 분유 먹이기
 * @returns {Promise<Object|null>}
 */
export async function feedMilk() {
  return processFarmXpEvent(FARM_MILK_EVENT_KEY)
}

/**
 * @param {Object} crop
 */
function normalizeFieldCrop(crop) {
  if (!crop) return null
  return {
    id: crop.id,
    row: crop.row,
    col: crop.col,
    stage: crop.stage,
    xp: crop.xp,
    nextStageXpRequired: crop.nextStageXpRequired,
    maxStage: crop.maxStage ?? 4,
    cropImageUrl: crop.cropImageUrl ?? null,
    cropName: crop.cropName ?? null,
  }
}

/**
 * 농장 밭 상태 조회
 * @returns {Promise<Object>}
 */
export async function getMyFarmField() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      seedCount: 0,
      crops: [],
      waterXpAmount: 15,
      waterJellyCost: 10,
      gridCols: 5,
      gridRows: 4,
      maxCropStage: 4,
    }
  }

  try {
    const { data, error } = await supabase.rpc('get_my_farm_field')
    if (error) throw error
    return {
      seedCount: data?.seedCount ?? 0,
      crops: (data?.crops || []).map(normalizeFieldCrop).filter(Boolean),
      waterXpAmount: data?.waterXpAmount ?? 15,
      waterJellyCost: data?.waterJellyCost ?? 10,
      gridCols: data?.gridCols ?? 5,
      gridRows: data?.gridRows ?? 4,
      maxCropStage: data?.maxCropStage ?? 4,
    }
  } catch (error) {
    console.error('농장 밭 조회 실패:', error)
    return {
      seedCount: 0,
      crops: [],
      waterXpAmount: 15,
      waterJellyCost: 10,
      gridCols: 5,
      gridRows: 4,
      maxCropStage: 4,
    }
  }
}

/**
 * 씨앗 심기
 * @param {number} row
 * @param {number} col
 * @returns {Promise<Object|null>}
 */
export async function plantFarmSeed(row, col) {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const { data, error } = await supabase.rpc('plant_farm_seed', {
    p_cell_row: row,
    p_cell_col: col,
  })

  if (error) {
    console.error('씨앗 심기 오류:', error)
    throw error
  }

  return {
    crop: normalizeFieldCrop(data?.crop),
    seedCount: data?.seedCount ?? 0,
  }
}

/**
 * 작물에 물 주기
 * @param {string} cropId
 * @returns {Promise<Object|null>}
 */
export async function waterFarmCrop(cropId) {
  const userId = await getCurrentUserId()
  if (!userId || !cropId) return null

  const { data, error } = await supabase.rpc('water_farm_crop', {
    p_crop_id: cropId,
  })

  if (error) {
    console.error('물주기 오류:', error)
    throw error
  }

  if (data?.jellySpent > 0) {
    notifyJellyUpdated({ balance: null, awarded: -data.jellySpent })
  }

  return {
    crop: normalizeFieldCrop(data?.crop),
    xpAwarded: data?.xpAwarded ?? 0,
    jellySpent: data?.jellySpent ?? 0,
    leveledUp: Boolean(data?.leveledUp),
    newStage: data?.newStage ?? null,
  }
}

