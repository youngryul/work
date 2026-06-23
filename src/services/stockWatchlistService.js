import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * @typedef {Object} StockWatchlistItem
 * @property {string} id
 * @property {string} symbol
 * @property {string} displayName
 * @property {string | null} exchange
 * @property {number} sortOrder
 */

/**
 * @param {Record<string, unknown>} row
 * @returns {StockWatchlistItem}
 */
function mapWatchlistRow(row) {
  return {
    id: row.id,
    symbol: row.symbol,
    displayName: row.display_name ?? row.displayName,
    exchange: row.exchange ?? null,
    sortOrder: row.sort_order ?? row.sortOrder ?? 0,
  }
}

/**
 * @returns {Promise<StockWatchlistItem[]>}
 */
export async function getMyStockWatchlist() {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('user_stock_watchlist')
    .select('id, symbol, display_name, exchange, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('관심 종목 조회 오류:', error)
    throw error
  }

  return (data || []).map(mapWatchlistRow)
}

/**
 * @param {{ symbol: string, displayName: string, exchange?: string | null }} item
 * @returns {Promise<StockWatchlistItem>}
 */
export async function addStockToWatchlist({ symbol, displayName, exchange = null }) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data: existing, error: countError } = await supabase
    .from('user_stock_watchlist')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1)

  if (countError) throw countError

  const nextSortOrder = existing?.[0]?.sort_order != null ? existing[0].sort_order + 1 : 0

  const { data, error } = await supabase
    .from('user_stock_watchlist')
    .insert({
      user_id: userId,
      symbol,
      display_name: displayName,
      exchange,
      sort_order: nextSortOrder,
    })
    .select('id, symbol, display_name, exchange, sort_order')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('이미 관심 종목에 추가된 심볼입니다.')
    }
    throw error
  }

  return mapWatchlistRow(data)
}

/**
 * @param {string} id
 */
export async function removeStockFromWatchlist(id) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('user_stock_watchlist')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}
