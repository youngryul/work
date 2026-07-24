import { useState, useEffect } from 'react'
import {
  NAVIGATION_MENU_GROUPS,
  NAVIGATION_FOOTER_ITEMS,
  NAVIGATION_MENU_ITEMS,
  EXTERNAL_LINKS,
} from '../constants/navigationMenu.js'
import { isMainMenuItemAllowed } from '../constants/roleMenuPermissions.js'
import { useRoleMenuPermissions } from '../hooks/useRoleMenuPermissions.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { getMyFarmProgress } from '../services/farmService.js'
import MenuIcon from './MenuIcon.jsx'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * 사이드바 네비게이션 컴포넌트
 */
export default function NavigationSidebar({
  currentView,
  onViewChange,
  isOpen = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}) {
  const { signOut, user, isAdmin: isAdminUser, userRole } = useAuth()
  const [expandedMenus, setExpandedMenus] = useState(new Set())
  const [farmStage, setFarmStage] = useState(1)
  const { permissions: menuPermissions } = useRoleMenuPermissions(userRole)

  const allowedMenuIds = new Set(menuPermissions?.allowedMenuIds ?? [])
  const allowedFooterMenuIds = new Set(menuPermissions?.allowedFooterMenuIds ?? [])
  const allowedExternalLinkIds = new Set(menuPermissions?.allowedExternalLinkIds ?? [])
  const showAdminMenu = Boolean(menuPermissions?.showAdminMenu && isAdminUser)
  const showExternalLinks = allowedExternalLinkIds.size > 0

  useEffect(() => {
    const loadFarmProgress = async () => {
      if (!user) {
        setFarmStage(1)
        return
      }

      try {
        const progress = await getMyFarmProgress()
        setFarmStage(Number(progress?.stage || 1))
      } catch (error) {
        console.error('농장 해금 상태 조회 실패:', error)
        setFarmStage(1)
      }
    }

    loadFarmProgress()
  }, [user, currentView])

  useEffect(() => {
    const menuWithChildren = NAVIGATION_MENU_ITEMS.find(
      (item) => item.children && item.children.some((child) => child.id === currentView),
    )
    if (menuWithChildren) {
      setExpandedMenus(new Set([menuWithChildren.id]))
    }
  }, [currentView])

  const isItemVisible = (item) => {
    if (item.id === 'farm') return true
    if (item.id === 'farm-field') return farmStage >= 2
    if (item.id === 'gacha') return farmStage >= 3
    return isMainMenuItemAllowed(item.id, allowedMenuIds, item)
  }

  const handleMenuClick = (viewId, hasChildren = false) => {
    if (hasChildren) {
      const next = new Set(expandedMenus)
      if (next.has(viewId)) next.delete(viewId)
      else next.add(viewId)
      setExpandedMenus(next)
      return
    }

    if (viewId === 'category-settings') {
      if (window.openCategorySettings) {
        window.openCategorySettings()
      }
      if (window.innerWidth < 768 && onClose) onClose()
      return
    }

    onViewChange(viewId)
    if (window.innerWidth < 768 && onClose) onClose()
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('로그아웃 오류:', error)
      showToast('로그아웃에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const menuButtonClass = (isActive) => `
    w-full rounded-md transition-all duration-150 text-left
    flex items-center gap-2 min-w-0
    ${collapsed ? 'md:justify-center md:gap-0 md:px-1 md:py-1.5' : 'px-2.5 py-1.5'}
    ${
      isActive
        ? 'bg-green-500 text-white shadow-sm'
        : 'text-gray-600 hover:bg-green-50'
    }
  `

  const renderMenuItem = (item) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedMenus.has(item.id)
    const isActive =
      currentView === item.id ||
      (hasChildren && item.children.some((child) => child.id === currentView))

    return (
      <div key={item.id} className="space-y-0.5">
        <button
          type="button"
          onClick={() => handleMenuClick(item.id, hasChildren)}
          className={menuButtonClass(isActive)}
          title={collapsed ? item.label : ''}
        >
          <MenuIcon icon={item.icon} label={item.label} compact={collapsed} />
          {!collapsed && (
            <>
              <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
              {hasChildren && (
                <span className={`text-[10px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                  ▶
                </span>
              )}
            </>
          )}
        </button>
        {hasChildren && !collapsed && isExpanded && (
          <div className="ml-3 space-y-0.5 border-l border-gray-200 pl-2">
            {item.children
              .filter((child) => allowedMenuIds.has(child.id))
              .map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => handleMenuClick(child.id)}
                  className={menuButtonClass(currentView === child.id)}
                >
                  <MenuIcon icon={child.icon} label={child.label} size="sm" />
                  <span className="text-xs font-medium truncate">{child.label}</span>
                </button>
              ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 h-full bg-white/95 backdrop-blur-sm shadow-lg z-50
          transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          ${collapsed ? 'md:w-14' : 'md:w-52'}
        `}
      >
        <div className="flex flex-col h-full">
          <div className={`border-b border-gray-200 ${collapsed ? 'md:p-2 p-4' : 'px-3 py-3'}`}>
            <div className="flex items-center justify-between">
              {!collapsed && (
                <h1 className="text-base font-bold text-gray-800">메뉴</h1>
              )}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="hidden md:block text-gray-500 hover:text-gray-700 text-sm p-1 rounded hover:bg-gray-100"
                  title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
                >
                  {collapsed ? '→' : '←'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="md:hidden text-gray-500 hover:text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <nav className={`flex-1 overflow-y-auto overflow-x-visible ${collapsed ? 'md:p-1.5 p-3' : 'p-2'}`}>
            <div className="space-y-3">
              {NAVIGATION_MENU_GROUPS.map((group) => {
                const visibleItems = group.items.filter(isItemVisible)
                if (visibleItems.length === 0) return null

                return (
                  <div key={group.id}>
                    {!collapsed && (
                      <div className="flex items-center gap-1.5 px-2 mb-1">
                        <span className="text-xs leading-none" aria-hidden="true">
                          {group.icon}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-400 tracking-wide">
                          {group.label}
                        </span>
                      </div>
                    )}
                    {collapsed && (
                      <div className="hidden md:flex justify-center mb-1" title={group.label}>
                        <span className="text-sm leading-none opacity-70">{group.icon}</span>
                      </div>
                    )}
                    <div className="space-y-0.5">{visibleItems.map(renderMenuItem)}</div>
                  </div>
                )
              })}
            </div>

            {showExternalLinks && (
              <>
                <div className={`border-t border-gray-200 ${collapsed ? 'my-2' : 'my-3'}`} />
                {!collapsed && (
                  <div className="px-2 mb-1 text-[11px] font-semibold text-gray-400">외부</div>
                )}
                <div className="space-y-0.5">
                  {EXTERNAL_LINKS.filter((link) => allowedExternalLinkIds.has(link.id)).map(
                    (link) => (
                      <a
                        key={link.id}
                        href={link.href}
                        target={link.target}
                        rel="noopener noreferrer"
                        className={`
                          w-full rounded-md transition-all duration-150 text-left
                          flex items-center gap-2 min-w-0
                          ${collapsed ? 'md:justify-center md:gap-0 md:px-1 md:py-1.5' : 'px-2.5 py-1.5'}
                          text-gray-600 hover:bg-purple-100 hover:text-purple-600
                        `}
                        title={collapsed ? link.label : ''}
                      >
                        <MenuIcon icon={link.icon} label={link.label} compact={collapsed} />
                        {!collapsed && (
                          <span className="text-sm font-medium truncate">{link.label}</span>
                        )}
                      </a>
                    ),
                  )}
                </div>
              </>
            )}

            <div className={`border-t border-gray-200 ${collapsed ? 'my-2' : 'my-3'}`} />

            <div className="space-y-0.5">
              {!collapsed && user && (
                <div className="px-2 py-1 text-[11px] text-gray-400 font-sans truncate">
                  {user.email}
                </div>
              )}

              {NAVIGATION_FOOTER_ITEMS.filter(
                (item) =>
                  allowedFooterMenuIds.has(item.id) &&
                  (item.id !== 'my-page' || farmStage >= 3),
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleMenuClick(item.id)}
                  className={menuButtonClass(currentView === item.id)}
                  title={collapsed ? item.label : ''}
                >
                  <MenuIcon icon={item.icon} label={item.label} compact={collapsed} />
                  {!collapsed && (
                    <span className="text-sm font-medium truncate">{item.label}</span>
                  )}
                </button>
              ))}

              {showAdminMenu && (
                <button
                  type="button"
                  onClick={() => handleMenuClick('admin')}
                  className={`
                    w-full rounded-md transition-all duration-150 text-left
                    flex items-center gap-2
                    ${collapsed ? 'md:justify-center md:gap-0 md:px-1 md:py-1.5' : 'px-2.5 py-1.5'}
                    ${
                      currentView === 'admin'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-blue-600 hover:bg-blue-50'
                    }
                  `}
                  title={collapsed ? '관리자' : ''}
                >
                  <span className="text-base flex-shrink-0 leading-none">🔐</span>
                  {!collapsed && <span className="text-sm font-medium">관리자</span>}
                </button>
              )}

              <button
                type="button"
                onClick={handleSignOut}
                className={`
                  w-full rounded-md transition-all duration-150 text-left
                  flex items-center gap-2
                  ${collapsed ? 'md:justify-center md:gap-0 md:px-1 md:py-1.5' : 'px-2.5 py-1.5'}
                  text-red-600 hover:bg-red-50 hover:text-red-700
                `}
                title={collapsed ? '로그아웃' : ''}
              >
                <span className="text-base leading-none">🚪</span>
                {!collapsed && <span className="text-sm font-medium">로그아웃</span>}
              </button>
            </div>
          </nav>
        </div>
      </aside>
    </>
  )
}
