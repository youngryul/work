import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 현재 화면 사용을 기록한다. 실패해도 앱 사용을 막지 않는다.
 * @param {string} viewId
 */
export async function recordUserActivity(viewId) {
  const userId = await getCurrentUserId()
  if (!userId || !viewId) return

  try {
    const { error } = await supabase.rpc('record_user_activity', { p_view: viewId })
    if (error) {
      console.warn('사용자 활동 기록 실패:', error.message)
    }
  } catch (error) {
    console.warn('사용자 활동 기록 실패:', error)
  }
}

/**
 * 관리자용 전체 사용자 활동 조회
 * @returns {Promise<Array<{
 *   userId: string,
 *   lastSeenAt: string|null,
 *   lastView: string,
 *   usedViews: string[],
 * }>>}
 */
export async function getUserActivityList() {
  const { data, error } = await supabase
    .from('user_activity')
    .select('user_id, last_seen_at, last_view, used_views')
    .order('last_seen_at', { ascending: false })

  if (error) {
    console.warn('사용자 활동 조회 실패:', error.message)
    return []
  }

  return (data || []).map((row) => ({
    userId: row.user_id,
    lastSeenAt: row.last_seen_at || null,
    lastView: row.last_view || '',
    usedViews: Array.isArray(row.used_views) ? row.used_views : [],
  }))
}
