/**
 * 유저별 애드센스(광고) 노출 설정
 * 테이블: user_ad_settings (supabase-user-ad-settings.sql 참고)
 */
import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { isAdmin } from './adminService.js'

/**
 * 현재 로그인 사용자에게 광고를 표시할지 여부
 * 설정 행이 없으면 true (기본: 노출)
 * @returns {Promise<boolean>}
 */
export async function getAdsEnabledForCurrentUser() {
  const userId = await getCurrentUserId()
  if (!userId) return false

  const { data, error } = await supabase
    .from('user_ad_settings')
    .select('ads_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('광고 설정 조회 오류:', error)
    return true
  }
  if (!data) return true
  return Boolean(data.ads_enabled)
}

/**
 * 여러 유저의 광고 노출 여부 (관리자 UI용)
 * @param {string[]} userIds
 * @returns {Promise<Map<string, boolean>>} userId -> ads_enabled (행 없으면 true)
 */
export async function getAdsEnabledMapForUsers(userIds) {
  const map = new Map()
  if (!userIds.length) return map

  const { data, error } = await supabase
    .from('user_ad_settings')
    .select('user_id, ads_enabled')
    .in('user_id', userIds)

  if (error) {
    console.error('광고 설정 일괄 조회 오류:', error)
    userIds.forEach((id) => map.set(id, true))
    return map
  }

  userIds.forEach((id) => map.set(id, true))
  data?.forEach((row) => map.set(row.user_id, Boolean(row.ads_enabled)))
  return map
}

/**
 * 관리자가 특정 유저의 광고 노출을 on/off
 * @param {string} targetUserId
 * @param {boolean} adsEnabled
 */
export async function setAdsEnabledForUser(targetUserId, adsEnabled) {
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) throw new Error('로그인이 필요합니다.')

  const admin = await isAdmin(currentUserId)
  if (!admin) throw new Error('관리자 권한이 필요합니다.')

  const { error } = await supabase
    .from('user_ad_settings')
    .upsert(
      {
        user_id: targetUserId,
        ads_enabled: adsEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error) throw error
}
