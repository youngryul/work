import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { SHOP_SEED_JELLY_COST_DEFAULT } from '../constants/shop.js'
import { notifyJellyUpdated } from '../utils/jellyEvents.js'

/**
 * 상점 씨앗 1개당 젤리 가격 조회
 * @returns {Promise<number>}
 */
export async function getShopSeedJellyCost() {
  try {
    const { data, error } = await supabase.rpc('get_shop_seed_jelly_cost')
    if (error) throw error
    return typeof data === 'number' ? data : Number(data) || SHOP_SEED_JELLY_COST_DEFAULT
  } catch (error) {
    console.error('씨앗 가격 조회 실패:', error)
    return SHOP_SEED_JELLY_COST_DEFAULT
  }
}

/**
 * 젤리로 씨앗 구매
 * @param {number} quantity
 * @returns {Promise<{ seedCount: number, purchased: number, jellySpent: number, jellyBalance: number, costPerSeed: number }>}
 */
export async function purchaseSeedsWithJelly(quantity) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase.rpc('purchase_farm_seeds_with_jelly', {
    p_quantity: quantity,
  })

  if (error) {
    console.error('씨앗 구매 오류:', error)
    throw new Error(error.message || '씨앗 구매에 실패했습니다.')
  }

  const result = {
    seedCount: data?.seedCount ?? 0,
    purchased: data?.purchased ?? quantity,
    jellySpent: data?.jellySpent ?? 0,
    jellyBalance: data?.jellyBalance ?? 0,
    costPerSeed: data?.costPerSeed ?? SHOP_SEED_JELLY_COST_DEFAULT,
  }

  if (result.jellySpent > 0) {
    notifyJellyUpdated({ balance: result.jellyBalance, spent: result.jellySpent })
  }

  return result
}
