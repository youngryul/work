import { useCallback, useEffect, useState } from 'react'
import { getMyMenuPermissions } from '../services/roleMenuService.js'
import { ROLE_MENU_PERMISSIONS_UPDATED_EVENT } from '../utils/roleMenuEvents.js'
import { getDefaultPermissionsForRole } from '../constants/roleMenuPermissions.js'

/**
 * 현재 사용자 역할의 메뉴 권한
 * @param {string} [userRole]
 * @returns {{ permissions: Object | null, isLoading: boolean, reload: () => Promise<void> }}
 */
export function useRoleMenuPermissions(userRole) {
  const [permissions, setPermissions] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getMyMenuPermissions()
      setPermissions(data)
    } catch {
      setPermissions({
        role: userRole || 'regular',
        ...getDefaultPermissionsForRole(userRole || 'regular'),
      })
    } finally {
      setIsLoading(false)
    }
  }, [userRole])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const handleUpdate = () => reload()
    window.addEventListener(ROLE_MENU_PERMISSIONS_UPDATED_EVENT, handleUpdate)
    return () => window.removeEventListener(ROLE_MENU_PERMISSIONS_UPDATED_EVENT, handleUpdate)
  }, [reload])

  return { permissions, isLoading, reload }
}
