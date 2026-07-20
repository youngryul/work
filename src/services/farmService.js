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
    characterId: data.characterId ?? data.character_id ?? null,
    name: data.name ?? null,
    grade: data.grade ?? null,
    imageUrl: data.imageUrl ?? data.image_url ?? null,
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
      canHarvest: false,
      fieldCropCount: 0,
      matureCropCount: 0,
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
      canHarvest: Boolean(data?.canHarvest),
      fieldCropCount: data?.fieldCropCount ?? 0,
      matureCropCount: data?.matureCropCount ?? 0,
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
      canHarvest: false,
      fieldCropCount: 0,
      matureCropCount: 0,
    }
  }
}

/**
 * @param {Object|null} row
 */
function normalizeWarehouseItem(row) {
  if (!row) return null
  return {
    cropGachaCharacterId: row.cropGachaCharacterId ?? row.crop_gacha_character_id,
    cropName: row.cropName ?? row.crop_name ?? '작물',
    cropImageUrl: row.cropImageUrl ?? row.crop_image_url ?? null,
    quantity: row.quantity ?? 0,
  }
}

/**
 * @param {Object|null} row
 */
function normalizeCropRequest(row) {
  if (!row) return null
  return {
    id: row.id,
    requesterCharacterId: row.requesterCharacterId ?? row.requester_character_id,
    requesterName: row.requesterName ?? row.requester_name ?? '포실이 친구',
    requesterImageUrl: row.requesterImageUrl ?? row.requester_image_url ?? null,
    cropGachaCharacterId: row.cropGachaCharacterId ?? row.crop_gacha_character_id,
    cropName: row.cropName ?? row.crop_name ?? '작물',
    cropImageUrl: row.cropImageUrl ?? row.crop_image_url ?? null,
    maxQuantity: row.maxQuantity ?? row.max_quantity ?? 1,
    warehouseQuantity: row.warehouseQuantity ?? row.warehouse_quantity ?? 0,
  }
}

/**
 * 창고·캐릭터 요청 상태
 * @returns {Promise<{ warehouse: Array, activeRequest: Object|null, totalWarehouseCount: number }>}
 */
export async function getFarmWarehouseState() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { warehouse: [], activeRequest: null, totalWarehouseCount: 0 }
  }

  const { data, error } = await supabase.rpc('get_farm_warehouse_state')
  if (error) {
    console.error('창고 상태 조회 실패:', error)
    throw error
  }

  return {
    warehouse: (data?.warehouse || []).map(normalizeWarehouseItem).filter(Boolean),
    activeRequest: normalizeCropRequest(data?.activeRequest),
    totalWarehouseCount: data?.totalWarehouseCount ?? 0,
  }
}

/**
 * 밭 전체 수확 (모든 작물 성숙 시)
 * @returns {Promise<Object>}
 */
export async function harvestFarmField() {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const { data, error } = await supabase.rpc('harvest_farm_field')
  if (error) {
    console.error('수확 오류:', error)
    throw error
  }

  return {
    harvested: (data?.harvested || []).map(normalizeWarehouseItem).filter(Boolean),
    harvestedCount: data?.harvestedCount ?? 0,
    warehouse: (data?.warehouse || []).map(normalizeWarehouseItem).filter(Boolean),
    activeRequest: normalizeCropRequest(data?.activeRequest),
  }
}

/**
 * 캐릭터 작물 요청 이행
 * @param {string} requestId
 * @param {number} giveQuantity
 * @returns {Promise<Object>}
 */
export async function fulfillFarmCropRequest(requestId, giveQuantity) {
  const userId = await getCurrentUserId()
  if (!userId || !requestId) return null

  const { data, error } = await supabase.rpc('fulfill_farm_crop_request', {
    p_request_id: requestId,
    p_give_quantity: giveQuantity,
  })

  if (error) {
    console.error('작물 요청 처리 오류:', error)
    throw error
  }

  if (data?.jellyAwarded > 0) {
    notifyJellyUpdated({ balance: data?.jellyBalance ?? null, awarded: data.jellyAwarded })
  }

  return {
    jellyAwarded: data?.jellyAwarded ?? 0,
    jellyBalance: data?.jellyBalance ?? 0,
    giveQuantity: data?.giveQuantity ?? giveQuantity,
    warehouse: (data?.warehouse || []).map(normalizeWarehouseItem).filter(Boolean),
    activeRequest: normalizeCropRequest(data?.activeRequest),
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

/**
 * 포실이 성장 랭킹 조회 (경험치·단계 순)
 * @param {number} [limit=50]
 * @returns {Promise<Array<{
 *   rank: number,
 *   userId: string,
 *   displayName: string,
 *   isMe: boolean,
 *   stage: number,
 *   xp: number,
 *   activeCharacter: { characterId: string, name: string, grade: string, imageUrl: string } | null
 * }>>}
 */
export async function getFarmRanking(limit = 50) {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100)
  const { data, error } = await supabase.rpc('get_farm_ranking', {
    p_limit: safeLimit,
  })
  if (error) {
    console.error('get_farm_ranking 오류:', error)
    // PostgREST: 함수가 없거나 스키마 캐시 미반영 시 404 / PGRST202
    if (
      error.code === 'PGRST202' ||
      error.code === '42883' ||
      /404|not find|Could not find/i.test(error.message || '')
    ) {
      throw new Error(
        '랭킹 기능이 DB에 없어요. supabase-farm-ranking.sql을 Supabase에서 실행해 주세요.',
      )
    }
    const msg = error.message || error.details || ''
    if (/active_character_id|does not exist/i.test(msg)) {
      throw new Error(
        '랭킹 DB 설정이 완료되지 않았어요. supabase-farm-ranking.sql을 Supabase에서 실행해 주세요.',
      )
    }
    throw new Error(msg || '랭킹을 불러오지 못했습니다.')
  }

  let parsed = data
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data)
    } catch {
      parsed = []
    }
  }

  const rows = Array.isArray(parsed) ? parsed : []
  return rows.map((row) => ({
    rank: Number(row.rank) || 0,
    userId: row.userId || row.user_id || '',
    displayName: row.displayName || row.display_name || '포실이 농부',
    isMe: Boolean(row.isMe ?? row.is_me),
    stage: Number(row.stage) || 1,
    xp: Number(row.xp) || 0,
    activeCharacter: normalizeActiveCharacter(row.activeCharacter || row.active_character),
  }))
}

