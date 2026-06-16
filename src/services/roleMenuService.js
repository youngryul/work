import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { isAdmin } from './adminService.js'
import {
  getDefaultPermissionsForRole,
  USER_ROLES,
} from '../constants/roleMenuPermissions.js'
import { notifyRoleMenuPermissionsUpdated } from '../utils/roleMenuEvents.js'

/**
 * @param {Object} row
 */
function normalizePermissions(row) {
  return {
    role: row.role,
    allowedMenuIds: row.allowedMenuIds ?? row.allowed_menu_ids ?? [],
    allowedFooterMenuIds: row.allowedFooterMenuIds ?? row.allowed_footer_menu_ids ?? [],
    allowedExternalLinkIds: row.allowedExternalLinkIds ?? row.allowed_external_link_ids ?? [],
    showAdminMenu: Boolean(row.showAdminMenu ?? row.show_admin_menu),
    updatedAt: row.updatedAt ?? row.updated_at,
  }
}

/**
 * 현재 사용자 역할의 메뉴 권한
 * @returns {Promise<ReturnType<typeof normalizePermissions>>}
 */
export async function getMyMenuPermissions() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return normalizePermissions({ role: 'regular', ...getDefaultPermissionsForRole('regular') })
  }

  try {
    const { data, error } = await supabase.rpc('get_my_menu_permissions')
    if (error) throw error
    return normalizePermissions(data)
  } catch (error) {
    console.error('메뉴 권한 조회 실패:', error)
    return normalizePermissions({ role: 'regular', ...getDefaultPermissionsForRole('regular') })
  }
}

/**
 * 관리자: 전체 역할 메뉴 권한
 * @returns {Promise<Array>}
 */
export async function getAllRoleMenuPermissions() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const admin = await isAdmin(userId)
  if (!admin) throw new Error('관리자 권한이 필요합니다.')

  const { data, error } = await supabase.rpc('admin_get_all_role_menu_permissions')
  if (error) throw error

  const rows = Array.isArray(data) ? data : []
  const byRole = new Map(rows.map((row) => [row.role, normalizePermissions(row)]))

  return USER_ROLES.map((role) => {
    if (byRole.has(role)) return byRole.get(role)
    return normalizePermissions({ role, ...getDefaultPermissionsForRole(role) })
  })
}

/**
 * 관리자: 역할별 메뉴 권한 저장
 * @param {string} role
 * @param {{ allowedMenuIds: string[], allowedFooterMenuIds: string[], allowedExternalLinkIds: string[], showAdminMenu: boolean }} permissions
 */
export async function upsertRoleMenuPermissions(role, permissions) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const admin = await isAdmin(userId)
  if (!admin) throw new Error('관리자 권한이 필요합니다.')

  const { data, error } = await supabase.rpc('admin_upsert_role_menu_permissions', {
    p_role: role,
    p_allowed_menu_ids: permissions.allowedMenuIds,
    p_allowed_footer_menu_ids: permissions.allowedFooterMenuIds,
    p_allowed_external_link_ids: permissions.allowedExternalLinkIds,
    p_show_admin_menu: permissions.showAdminMenu,
  })

  if (error) throw error

  notifyRoleMenuPermissionsUpdated()
  return normalizePermissions(data)
}
