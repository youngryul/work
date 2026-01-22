import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 관리자 권한 확인
 * @param {string} [userId] - 사용자 ID (옵셔널, 없으면 현재 사용자)
 * @returns {Promise<boolean>} 관리자 여부
 */
export async function isAdmin(userId = null) {
  if (!userId) {
    userId = await getCurrentUserId()
  }
  if (!userId) {
    return false
  }

  try {
    // SECURITY DEFINER 함수를 사용하여 RLS 정책 우회
    const { data, error } = await supabase.rpc('is_admin', {
      user_uuid: userId
    })

    if (error) {
      // 함수가 없거나 에러 발생 시 직접 조회 시도 (자신의 레코드만 조회 가능)
      const { data: directData, error: directError } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (directError) {
        return false
      }

      return !!directData
    }

    return data === true
  } catch (error) {
    return false
  }
}

/**
 * 모든 관리자 목록 조회 (관리자만 가능)
 * @returns {Promise<Array>} 관리자 목록
 */
export async function getAdminUsers() {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  // 관리자 권한 확인
  const admin = await isAdmin(userId)
  if (!admin) {
    throw new Error('관리자 권한이 필요합니다.')
  }

  try {
    // SECURITY DEFINER 함수를 사용하여 관리자 목록 조회
    const { data, error } = await supabase.rpc('get_admin_users_list')

    if (error) {
      // 함수가 없거나 에러 발생 시 직접 조회 시도 (자신의 레코드만 조회 가능)
      const { data: directData, error: directError } = await supabase
        .from('admin_users')
        .select(`
          id,
          user_id,
          created_at,
          notes
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (directError) throw directError
      return directData || []
    }

    return data || []
  } catch (error) {
    console.error('관리자 목록 조회 실패:', error)
    throw error
  }
}

/**
 * 관리자 추가 (관리자만 가능)
 * @param {string} targetUserId - 추가할 사용자 ID
 * @param {string} notes - 메모
 * @returns {Promise<void>}
 */
export async function addAdminUser(targetUserId, notes = '') {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  // 관리자 권한 확인
  const admin = await isAdmin(userId)
  if (!admin) {
    throw new Error('관리자 권한이 필요합니다.')
  }

  try {
    const { error } = await supabase
      .from('admin_users')
      .insert({
        user_id: targetUserId,
        created_by: userId,
        notes: notes || null,
      })

    if (error) throw error
  } catch (error) {
    console.error('관리자 추가 실패:', error)
    throw error
  }
}

/**
 * 관리자 제거 (관리자만 가능)
 * @param {string} targetUserId - 제거할 사용자 ID
 * @returns {Promise<void>}
 */
export async function removeAdminUser(targetUserId) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  // 관리자 권한 확인
  const admin = await isAdmin(userId)
  if (!admin) {
    throw new Error('관리자 권한이 필요합니다.')
  }

  // 자기 자신은 제거할 수 없음
  if (targetUserId === userId) {
    throw new Error('자기 자신은 제거할 수 없습니다.')
  }

  try {
    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('user_id', targetUserId)

    if (error) throw error
  } catch (error) {
    console.error('관리자 제거 실패:', error)
    throw error
  }
}
