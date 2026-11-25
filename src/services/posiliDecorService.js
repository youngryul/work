/**
 * 포실이 꾸미기 서비스 — 아이템 목록·보유·착용
 * 구매·착용은 RPC(purchase_decor_item, equip_decor_item)로만 처리한다.
 */
import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { notifyJellyUpdated } from '../utils/jellyEvents.js'
import { isAdmin } from './adminService.js'
import {
  DECOR_SLOT_MAP,
  EMPTY_POSILI_LOADOUT,
  POSILI_LOADOUT_UPDATED_EVENT,
} from '../constants/posiliDecor.js'

/**
 * @param {Object} row
 */
function normalizeDecorItem(row) {
  return {
    id: row.id,
    slot: row.slot,
    name: row.name,
    description: row.description || '',
    imageUrl: row.image_url,
    rarity: row.rarity,
    priceJelly: Number(row.price_jelly) || 0,
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 착용 상태 변경을 다른 화면에 알린다
 * @param {Record<string, Object|null>} loadout
 */
function notifyLoadoutUpdated(loadout) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(POSILI_LOADOUT_UPDATED_EVENT, { detail: { loadout } }))
}

/**
 * 내 착용 상태 조회
 * @returns {Promise<Record<string, { itemId: string, name: string, imageUrl: string } | null>>}
 */
export async function getMyPosiliLoadout() {
  const userId = await getCurrentUserId()
  if (!userId) return { ...EMPTY_POSILI_LOADOUT }

  const { data, error } = await supabase
    .from('user_posili_loadout')
    .select('slot, item_id, decor_items ( id, name, image_url )')
    .eq('user_id', userId)

  if (error) throw error

  const loadout = { ...EMPTY_POSILI_LOADOUT }
  ;(data || []).forEach((row) => {
    const item = row.decor_items
    if (!item || !DECOR_SLOT_MAP[row.slot]) return
    loadout[row.slot] = { itemId: item.id, name: item.name, imageUrl: item.image_url }
  })
  return loadout
}

/**
 * 꾸미기 화면용 상태: 보이는 아이템(판매 중 + 내가 가진 것) · 보유 여부 · 착용 상태
 * @returns {Promise<{ items: Array<ReturnType<typeof normalizeDecorItem> & { owned: boolean }>, loadout: Record<string, Object|null> }>}
 */
export async function getMyDecorState() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const [itemsRes, ownedRes, loadout] = await Promise.all([
    supabase
      .from('decor_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('user_decor_items').select('item_id').eq('user_id', userId),
    getMyPosiliLoadout(),
  ])

  if (itemsRes.error) throw itemsRes.error
  if (ownedRes.error) throw ownedRes.error

  const ownedIds = new Set((ownedRes.data || []).map((row) => row.item_id))

  const items = (itemsRes.data || [])
    .map((row) => ({ ...normalizeDecorItem(row), owned: ownedIds.has(row.id) }))
    // 관리자도 일반 화면에서는 판매 중이거나 가진 것만 본다
    .filter((item) => item.isActive || item.owned)

  return { items, loadout }
}

/**
 * 젤리로 아이템 구매
 * @param {string} itemId
 * @returns {Promise<{ itemId: string, slot: string, jellySpent: number, jellyBalance: number }>}
 */
export async function purchaseDecorItem(itemId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase.rpc('purchase_decor_item', { p_item_id: itemId })

  if (error) {
    console.error('꾸미기 아이템 구매 오류:', error)
    throw new Error(error.message || '아이템 구매에 실패했어요.')
  }

  const result = {
    itemId: data?.itemId ?? itemId,
    slot: data?.slot ?? null,
    jellySpent: data?.jellySpent ?? 0,
    jellyBalance: data?.jellyBalance ?? 0,
  }

  if (result.jellySpent > 0) {
    notifyJellyUpdated({ balance: result.jellyBalance, spent: result.jellySpent })
  }

  return result
}

/**
 * 착용 / 해제 (itemId가 null이면 해당 부위 해제)
 * @param {string} slot
 * @param {string|null} itemId
 * @returns {Promise<Record<string, Object|null>>} 변경 후 착용 상태
 */
export async function equipDecorItem(slot, itemId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase.rpc('equip_decor_item', {
    p_slot: slot,
    p_item_id: itemId,
  })

  if (error) {
    console.error('꾸미기 착용 오류:', error)
    throw new Error(error.message || '착용에 실패했어요.')
  }

  const loadout = await getMyPosiliLoadout()
  notifyLoadoutUpdated(loadout)
  return loadout
}

// ---------------------------------------------------------------------------
// 관리자
// ---------------------------------------------------------------------------

async function assertAdmin() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')
  const admin = await isAdmin(userId)
  if (!admin) throw new Error('관리자 권한이 필요합니다.')
}

/**
 * @param {{ slot?: string, name?: string, description?: string, imageUrl?: string, rarity?: string, priceJelly?: number, isActive?: boolean, sortOrder?: number }} params
 */
function toDecorRow(params) {
  const row = {}
  if (params.slot !== undefined) {
    if (!DECOR_SLOT_MAP[params.slot]) throw new Error('알 수 없는 꾸미기 부위예요.')
    row.slot = params.slot
  }
  if (params.name !== undefined) row.name = params.name.trim()
  if (params.description !== undefined) row.description = params.description.trim()
  if (params.imageUrl !== undefined) row.image_url = params.imageUrl
  if (params.rarity !== undefined) row.rarity = params.rarity
  if (params.priceJelly !== undefined) {
    row.price_jelly = Math.max(0, Math.floor(Number(params.priceJelly) || 0))
  }
  if (params.isActive !== undefined) row.is_active = Boolean(params.isActive)
  if (params.sortOrder !== undefined) row.sort_order = Math.floor(Number(params.sortOrder) || 0)
  return row
}

/**
 * 관리자: 전체 아이템 (판매 종료 포함)
 */
export async function getAllDecorItems() {
  await assertAdmin()

  const { data, error } = await supabase
    .from('decor_items')
    .select('*')
    .order('slot', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []).map(normalizeDecorItem)
}

/**
 * 관리자: 아이템 등록
 * @param {Parameters<typeof toDecorRow>[0]} params
 */
export async function createDecorItem(params) {
  await assertAdmin()

  const row = toDecorRow(params)
  if (!row.name) throw new Error('이름을 입력해주세요.')
  if (!row.image_url) throw new Error('이미지를 업로드해주세요.')
  if (!row.slot) throw new Error('부위를 선택해주세요.')

  const { data, error } = await supabase.from('decor_items').insert([row]).select('*').single()

  if (error) throw error
  return normalizeDecorItem(data)
}

/**
 * 관리자: 아이템 수정
 * @param {string} id
 * @param {Parameters<typeof toDecorRow>[0]} params
 */
export async function updateDecorItem(id, params) {
  await assertAdmin()

  const row = { ...toDecorRow(params), updated_at: new Date().toISOString() }
  if (row.name === '') throw new Error('이름을 입력해주세요.')

  const { data, error } = await supabase
    .from('decor_items')
    .update(row)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return normalizeDecorItem(data)
}

/**
 * 관리자: 아이템 삭제 (가진 사람의 보유·착용 기록도 함께 지워진다)
 * @param {string} id
 */
export async function deleteDecorItem(id) {
  await assertAdmin()

  const { error } = await supabase.from('decor_items').delete().eq('id', id)
  if (error) throw error
}
