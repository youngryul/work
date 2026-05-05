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
 * user_id 를 여러 테이블에서 수집 후 user_roles 와 join
 * @returns {Promise<Array<{userId, email, role}>>}
 */
export async function getAllUsersWithRoles() {
  const currentUserId = await getCurrentUserId()
  if (!currentUserId) throw new Error('로그인이 필요합니다.')

  const admin = await isAdmin(currentUserId)
  if (!admin) throw new Error('관리자 권한이 필요합니다.')

  // 여러 테이블에서 고유 user_id 수집
  const userIds = new Set()
  const tables = ['tasks', 'diaries', 'reading_records', 'five_year_answers']

  await Promise.allSettled(
    tables.map(async (table) => {
      const { data } = await supabase.from(table).select('user_id')
      data?.forEach((row) => { if (row.user_id) userIds.add(row.user_id) })
    })
  )

  if (userIds.size === 0) return []

  const userIdList = Array.from(userIds)

  // 이메일 조회 (기존 RPC 사용)
  const emailMap = new Map()
  try {
    const { data: emailData } = await supabase.rpc('get_user_emails', { user_ids: userIdList })
    emailData?.forEach((u) => { if (u.user_id) emailMap.set(u.user_id, u.email) })
  } catch {
    // 실패 시 user_id 그대로 표시
  }

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
