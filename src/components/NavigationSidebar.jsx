import { useState, useEffect } from 'react'
import {
  NAVIGATION_MENU_ITEMS,
  EXTERNAL_LINKS,
  SIDEBAR_HIDDEN_MENU_ITEM_IDS,
} from '../constants/navigationMenu.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import MenuIcon from './MenuIcon.jsx'
import { showToast, TOAST_TYPES } from './Toast.jsx'

// 역할별 메인 메뉴 제한 (null = 제한 없음)
const REGULAR_MENU_IDS = new Set([
  'today',
  'backlog',
  'todo-calendar',
  'diary-calendar',
  'gacha',
  'my-page',
])

/**
 * 사이드바 네비게이션 컴포넌트
 * @param {string} currentView - 현재 선택된 뷰
 * @param {Function} onViewChange - 뷰 변경 핸들러
 * @param {boolean} isOpen - 사이드바 열림 상태 (모바일)
 * @param {Function} onClose - 사이드바 닫기 핸들러 (모바일)
 * @param {boolean} collapsed - 사이드바 접힘 상태 (데스크톱)
 * @param {Function} onToggleCollapse - 사이드바 접기/펼치기 토글 핸들러
 */
export default function NavigationSidebar({ 
  currentView, 
  onViewChange, 
  isOpen = false, 
  onClose,
  collapsed = false,
  onToggleCollapse
}) {
  const { signOut, user, isAdmin: isAdminUser, isSuperuser, userRole } = useAuth()
  const [expandedMenus, setExpandedMenus] = useState(new Set())

  // 역할별 메인 메뉴 필터 (admin·superuser = 제한 없음, regular = 3개만)
  const visibleMenuIds = (isAdminUser || isSuperuser) ? null : REGULAR_MENU_IDS
  // 외부 링크는 admin·superuser만 표시
  const showExternalLinks = isAdminUser || isSuperuser

  /**
   * 하위 메뉴가 있는 메뉴의 펼침/접힘 상태 관리
   */
  useEffect(() => {
    // 현재 뷰가 하위 메뉴에 속하는지 확인하고 상위 메뉴를 펼침
    const menuWithChildren = NAVIGATION_MENU_ITEMS.find(
      item => item.children && item.children.some(child => child.id === currentView)
    )
    if (menuWithChildren) {
      setExpandedMenus(new Set([menuWithChildren.id]))
    }
  }, [currentView])

  /**
   * 메뉴 클릭 핸들러
   */
  const handleMenuClick = (viewId, hasChildren = false) => {
    // 하위 메뉴가 있는 경우 펼침/접힘 토글
    if (hasChildren) {
      const newExpanded = new Set(expandedMenus)
      if (newExpanded.has(viewId)) {
        newExpanded.delete(viewId)
      } else {
        newExpanded.add(viewId)
      }
      setExpandedMenus(newExpanded)
      return
    }

    // 카테고리 설정은 모달로 열기
    if (viewId === 'category-settings') {
      if (window.openCategorySettings) {
        window.openCategorySettings()
      }
      // 모바일에서 메뉴 클릭 시 사이드바 닫기
      if (window.innerWidth < 768 && onClose) {
        onClose()
      }
      return
    }
    
    onViewChange(viewId)
    // 모바일에서 메뉴 클릭 시 사이드바 닫기
    if (window.innerWidth < 768 && onClose) {
      onClose()
    }
  }

  /**
   * 로그아웃 핸들러
   */
  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('로그아웃 오류:', error)
      showToast('로그아웃에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  return (
    <>
      {/* 모바일 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`
          fixed left-0 top-0 h-full bg-white/95 backdrop-blur-sm shadow-lg z-50
          transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          ${collapsed ? 'md:w-20' : 'md:w-64'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* 헤더 */}
          <div className={`border-b border-gray-200 ${collapsed ? 'md:p-2 p-6' : 'p-6'}`}>
            <div className="flex items-center justify-between">
              {!collapsed && (
                <h1 className="text-2xl font-bold text-gray-800">메뉴</h1>
              )}
              <div className="flex items-center gap-2">
                {/* 데스크톱 토글 버튼 */}
                <button
                  onClick={onToggleCollapse}
                  className="hidden md:block text-gray-500 hover:text-gray-700 text-xl p-1 rounded hover:bg-gray-100"
                  title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
                >
                  {collapsed ? '→' : '←'}
                </button>
                {/* 모바일 닫기 버튼 */}
                <button
                  onClick={onClose}
                  className="md:hidden text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          {/* 메뉴 목록 */}
          <nav className={`flex-1 overflow-y-auto overflow-x-visible ${collapsed ? 'md:p-2 p-4' : 'p-4'}`}>
            <div className="space-y-2">
              {NAVIGATION_MENU_ITEMS.filter(
                item =>
                  !SIDEBAR_HIDDEN_MENU_ITEM_IDS.has(item.id) &&
                  item.id !== 'announcements' &&
                  item.id !== 'my-page' &&
                  item.id !== 'settings' &&
                  (visibleMenuIds === null || visibleMenuIds.has(item.id))
              ).map((item) => {
                const hasChildren = item.children && item.children.length > 0
                const isExpanded = expandedMenus.has(item.id)
                const isActive = currentView === item.id || (hasChildren && item.children.some(child => child.id === currentView))
                
                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      onClick={() => handleMenuClick(item.id, hasChildren)}
                      className={`
                        w-full rounded-lg transition-all duration-200 text-left
                        flex items-center gap-3 min-w-0
                        ${collapsed ? 'md:justify-center md:gap-0 md:px-1.5 md:py-2.5' : 'px-4 py-3'}
                        ${
                          isActive
                            ? 'bg-green-500 text-white shadow-md'
                            : 'text-gray-600 hover:bg-green-50'
                        }
                      `}
                      title={collapsed ? item.label : ''}
                    >
                      <MenuIcon iconSrc={item.iconSrc} icon={item.icon} label={item.label} compact={collapsed} />
                      {!collapsed && (
                        <>
                          <span className="text-lg font-medium flex-1">{item.label}</span>
                          {hasChildren && (
                            <span className={`text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                              ▶
                            </span>
                          )}
                        </>
                      )}
                    </button>
                    {/* 하위 메뉴 */}
                    {hasChildren && !collapsed && isExpanded && (
                      <div className="ml-4 space-y-1">
                        {item.children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => handleMenuClick(child.id)}
                            className={`
                              w-full rounded-lg transition-all duration-200 text-left
                              flex items-center gap-3 px-4 py-2
                              ${
                                currentView === child.id
                                  ? 'bg-green-500 text-white shadow-md'
                                  : 'text-gray-600 hover:bg-green-50'
                              }
                            `}
                          >
                            <MenuIcon iconSrc={child.iconSrc} icon={child.icon} label={child.label} size="sm" />
                            <span className="text-base font-medium">{child.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 외부 링크 (admin·superuser만 표시) */}
            {showExternalLinks && (
              <>
                <div className={`border-t border-gray-200 ${collapsed ? 'my-4' : 'my-6'}`} />
                <div className="space-y-2">
                  {EXTERNAL_LINKS.map((link) => (
                    <a
                      key={link.id}
                      href={link.href}
                      target={link.target}
                      rel="noopener noreferrer"
                      className={`
                        w-full rounded-lg transition-all duration-200 text-left
                        flex items-center gap-3 min-w-0
                        ${collapsed ? 'md:justify-center md:gap-0 md:px-1.5 md:py-2.5' : 'px-4 py-3'}
                        text-gray-600 hover:bg-purple-100 hover:text-purple-600
                      `}
                      title={collapsed ? link.label : ''}
                    >
                      <MenuIcon iconSrc={link.iconSrc} icon={link.icon} label={link.label} compact={collapsed} />
                      {!collapsed && (
                        <span className="text-lg font-medium">{link.label}</span>
                      )}
                    </a>
                  ))}
                </div>
              </>
            )}

            {/* 구분선 */}
            <div className={`border-t border-gray-200 ${collapsed ? 'my-4' : 'my-6'}`} />

            {/* 사용자 정보 및 로그아웃 */}
            <div className="space-y-2">
              {!collapsed && user && (
                <div className="px-4 py-2 text-sm text-gray-500 font-sans">
                  {user.email}
                </div>
              )}

              {/* 공지사항·마이페이지·설정 (전체 역할 표시) */}
              <div className="space-y-2">
                {NAVIGATION_MENU_ITEMS.filter(item =>
                  item.id === 'announcements' || item.id === 'my-page' || item.id === 'settings'
                ).map((item) => (
                    <button
                        key={item.id}
                        onClick={() => handleMenuClick(item.id)}
                        className={`
                    w-full rounded-lg transition-all duration-200 text-left
                    flex items-center gap-3
                    ${collapsed ? 'md:justify-center md:gap-0 md:px-1.5 md:py-2.5' : 'px-4 py-3'}
                    ${
                            currentView === item.id
                                ? 'bg-green-500 text-white shadow-md'
                                : 'text-gray-600 hover:bg-green-50'
                        }
                  `}
                        title={collapsed ? item.label : ''}
                    >
                      <MenuIcon iconSrc={item.iconSrc} icon={item.icon} label={item.label} compact={collapsed} />
                      {!collapsed && (
                          <span className="text-lg font-medium">{item.label}</span>
                      )}
                    </button>
                ))}
              </div>

              {/* 관리자 메뉴 (관리자만 표시, 공지사항 아래) */}
              {isAdminUser && (
                <div className="space-y-2">
                  <button
                    onClick={() => handleMenuClick('admin')}
                    className={`
                      w-full rounded-lg transition-all duration-200 text-left
                      flex items-center gap-3
                      ${collapsed ? 'md:justify-center md:gap-0 md:px-1.5 md:py-2.5' : 'px-4 py-3'}
                      ${
                        currentView === 'admin'
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'text-blue-600 hover:bg-blue-50'
                      }
                    `}
                    title={collapsed ? '관리자' : ''}
                  >
                    <span className="text-xl flex-shrink-0">🔐</span>
                    {!collapsed && (
                      <span className="text-lg font-medium">관리자</span>
                    )}
                  </button>
                </div>
              )}

              <button
                  onClick={handleSignOut}
                  className={`
                  w-full rounded-lg transition-all duration-200 text-left
                  flex items-center gap-3
                  ${collapsed ? 'md:justify-center md:gap-0 md:px-1.5 md:py-2.5' : 'px-4 py-3'}
                  text-red-600 hover:bg-red-50 hover:text-red-700
                `}
                  title={collapsed ? '로그아웃' : ''}
              >
                <span className="text-xl">🚪</span>
                {!collapsed && (
                    <span className="text-lg font-medium">로그아웃</span>
                )}
              </button>
            </div>
          </nav>
        </div>
      </aside>
    </>
  )
}

