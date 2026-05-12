import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { isAdmin } from './adminService.js'

/**
 * 현재 사용자 또는 특정 사용자의 role 조회
 * @param {string} [userId]
 * @returns {Promise<'admin'|'regular'>}
 */
export async function getUserRole(userId = null) {
  const targetId = userId || (await getCurrentUserId())
  if (!targetId) return 'regular'

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', targetId)
    .maybeSingle()

  if (error || !data) return 'regular'
  return data.role
}

/**
 * 관리자가 특정 사용자의 role 변경
 * @param {string} targetUserId
 * @param {'admin'|'superuser'|'regular'} role
 */
export async function setUserRole(targetUserId, role) {
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) throw new Error('로그인이 필요합니다.')

  const admin = await isAdmin(currentUserId)
  if (!admin) throw new Error('관리자 권한이 필요합니다.')

  const { error } = await supabase
    .from('user_roles')
    .upsert({
      user_id: targetUserId,
      role,
      updated_at: new Date().toISOString(),
      updated_by: currentUserId,
    }, { onConflict: 'user_id' })

  if (error) throw error
}

/**
 * 전체 유저 목록 + role 조회 (관리자 전용)
 * auth.users 기준 전체 유저 조회 후 user_roles 와 join
 * @returns {Promise<Array<{userId, email, role}>>}
 */
export async function getAllUsersWithRoles() {
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) throw new Error('로그인이 필요합니다.')

  const admin = await isAdmin(currentUserId)
  if (!admin) throw new Error('관리자 권한이 필요합니다.')

  // auth.users 기반 전체 유저 조회
  let userIdList = []
  const emailMap = new Map()
  try {
    const { data: allUsers, error: allUsersError } = await supabase.rpc('get_all_users_for_admin')
    if (!allUsersError && Array.isArray(allUsers)) {
      allUsers.forEach((userData) => {
        if (!userData.user_id) return
        userIdList.push(userData.user_id)
        emailMap.set(userData.user_id, userData.email || userData.user_id)
      })
    }
  } catch {
    // 함수 미배포 환경 폴백 처리
  }

  // RPC 함수가 없는 환경 폴백: 기존 방식으로 user_id 수집
  if (userIdList.length === 0) {
    const userIds = new Set()
    const userIdSourceTables = [
      'tasks',
      'diaries',
      'reading_records',
      'five_year_answers',
      'user_preferences',
      'user_roles',
      'admin_users',
    ]

    await Promise.allSettled(
      userIdSourceTables.map(async (table) => {
        const { data } = await supabase.from(table).select('user_id')
        data?.forEach((row) => {
          if (row.user_id) userIds.add(row.user_id)
        })
      })
    )

    userIdList = Array.from(userIds)

    if (userIdList.length > 0) {
      try {
        const { data: emailData } = await supabase.rpc('get_user_emails', { user_ids: userIdList })
        emailData?.forEach((u) => {
          if (u.user_id) emailMap.set(u.user_id, u.email)
        })
      } catch {
        // 실패 시 user_id 그대로 표시
      }
    }
  }

  if (userIdList.length === 0) return []

  // role 조회
  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .in('user_id', userIdList)

  const roleMap = new Map()
  rolesData?.forEach((r) => roleMap.set(r.user_id, r.role))

  return userIdList.map((uid) => ({
    userId: uid,
    email: emailMap.get(uid) || uid,
    role: roleMap.get(uid) || 'regular',
  }))
}
