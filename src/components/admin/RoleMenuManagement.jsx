import { useEffect, useState } from 'react'
import {
  buildMenuLabelMap,
  DEFAULT_ROLE_MENU_PERMISSIONS,
  ROLE_MENU_CONFIG_GROUPS,
  USER_ROLE_LABELS,
  USER_ROLES,
} from '../../constants/roleMenuPermissions.js'
import {
  getAllRoleMenuPermissions,
  upsertRoleMenuPermissions,
} from '../../services/roleMenuService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * @returns {{ allowedMenuIds: Set<string>, allowedFooterMenuIds: Set<string>, allowedExternalLinkIds: Set<string>, showAdminMenu: boolean }}
 */
function toDraftState(permissions) {
  return {
    allowedMenuIds: new Set(permissions.allowedMenuIds || []),
    allowedFooterMenuIds: new Set(permissions.allowedFooterMenuIds || []),
    allowedExternalLinkIds: new Set(permissions.allowedExternalLinkIds || []),
    showAdminMenu: Boolean(permissions.showAdminMenu),
  }
}

/**
 * 관리자: 역할별 메뉴 권한 설정
 */
export default function RoleMenuManagement() {
  const [selectedRole, setSelectedRole] = useState('regular')
  const [draftByRole, setDraftByRole] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const menuLabels = buildMenuLabelMap()

  const load = async () => {
    setLoading(true)
    try {
      const rows = await getAllRoleMenuPermissions()
      const next = {}
      USER_ROLES.forEach((role) => {
        const row = rows.find((r) => r.role === role)
        next[role] = toDraftState(row || DEFAULT_ROLE_MENU_PERMISSIONS[role])
      })
      setDraftByRole(next)
    } catch {
      showToast('메뉴 권한을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const draft = draftByRole[selectedRole]

  const updateDraft = (updater) => {
    setDraftByRole((prev) => ({
      ...prev,
      [selectedRole]: updater(prev[selectedRole]),
    }))
  }

  const toggleMenuId = (menuId, group) => {
    updateDraft((current) => {
      const next = {
        allowedMenuIds: new Set(current.allowedMenuIds),
        allowedFooterMenuIds: new Set(current.allowedFooterMenuIds),
        allowedExternalLinkIds: new Set(current.allowedExternalLinkIds),
        showAdminMenu: current.showAdminMenu,
      }

      if (group.adminOnly) {
        next.showAdminMenu = !current.showAdminMenu
        return next
      }

      if (group.footer) {
        if (next.allowedFooterMenuIds.has(menuId)) next.allowedFooterMenuIds.delete(menuId)
        else next.allowedFooterMenuIds.add(menuId)
        return next
      }

      if (group.external) {
        if (next.allowedExternalLinkIds.has(menuId)) next.allowedExternalLinkIds.delete(menuId)
        else next.allowedExternalLinkIds.add(menuId)
        return next
      }

      if (next.allowedMenuIds.has(menuId)) next.allowedMenuIds.delete(menuId)
      else next.allowedMenuIds.add(menuId)
      return next
    })
  }

  const isChecked = (menuId, group) => {
    if (!draft) return false
    if (group.adminOnly) return draft.showAdminMenu
    if (group.footer) return draft.allowedFooterMenuIds.has(menuId)
    if (group.external) return draft.allowedExternalLinkIds.has(menuId)
    return draft.allowedMenuIds.has(menuId)
  }

  const applyDefaults = () => {
    const defaults = DEFAULT_ROLE_MENU_PERMISSIONS[selectedRole]
    setDraftByRole((prev) => ({
      ...prev,
      [selectedRole]: toDraftState(defaults),
    }))
    showToast('기본값을 불러왔습니다. 저장하면 반영됩니다.', TOAST_TYPES.INFO)
  }

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      await upsertRoleMenuPermissions(selectedRole, {
        allowedMenuIds: [...draft.allowedMenuIds],
        allowedFooterMenuIds: [...draft.allowedFooterMenuIds],
        allowedExternalLinkIds: [...draft.allowedExternalLinkIds],
        showAdminMenu: draft.showAdminMenu,
      })
      showToast(`${USER_ROLE_LABELS[selectedRole]} 메뉴 설정을 저장했습니다.`, TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error?.message || '저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !draft) {
    return (
      <div className="text-center py-12 text-gray-500 font-sans">로딩 중...</div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <p className="text-sm text-indigo-900">
          역할별로 표시할 사이드바 메뉴를 설정합니다. 변경 사항은 해당 역할 사용자의 메뉴에 즉시 반영됩니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {USER_ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setSelectedRole(role)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              selectedRole === role
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {USER_ROLE_LABELS[role]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-800">
            {USER_ROLE_LABELS[selectedRole]} 메뉴
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyDefaults}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              기본값 불러오기
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {ROLE_MENU_CONFIG_GROUPS.map((group) => (
          <section key={group.title}>
            <h4 className="text-sm font-bold text-gray-700 mb-3">{group.title}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {group.menuIds.map((menuId) => (
                <label
                  key={menuId}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isChecked(menuId, group)}
                    onChange={() => toggleMenuId(menuId, group)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-800">
                    {group.adminOnly ? '관리자 대시보드' : menuLabels[menuId] || menuId}
                  </span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
