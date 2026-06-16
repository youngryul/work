/** 역할별 메뉴 권한 변경 시 사이드바 갱신 */
export const ROLE_MENU_PERMISSIONS_UPDATED_EVENT = 'roleMenuPermissionsUpdated'

export function notifyRoleMenuPermissionsUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ROLE_MENU_PERMISSIONS_UPDATED_EVENT))
}
