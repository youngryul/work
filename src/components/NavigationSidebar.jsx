import { NAVIGATION_MENU_ITEMS, EXTERNAL_LINKS } from '../constants/navigationMenu.js'
import { useAuth } from '../contexts/AuthContext.jsx'

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
  const { signOut, user } = useAuth()

  /**
   * 메뉴 클릭 핸들러
   */
  const handleMenuClick = (viewId) => {
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
      alert('로그아웃에 실패했습니다.')
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
          ${collapsed ? 'md:w-16' : 'md:w-64'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* 헤더 */}
          <div className={`p-6 border-b border-gray-200 ${collapsed ? 'md:p-4' : ''}`}>
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
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {NAVIGATION_MENU_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleMenuClick(item.id)}
                  className={`
                    w-full rounded-lg transition-all duration-200 text-left
                    flex items-center gap-3
                    ${collapsed ? 'md:justify-center md:px-2 md:py-3' : 'px-4 py-3'}
                    ${
                      currentView === item.id
                        ? 'bg-indigo-500 text-white shadow-md'
                        : 'text-gray-600 hover:bg-indigo-50'
                    }
                  `}
                  title={collapsed ? item.label : ''}
                >
                  <span className="text-xl flex-shrink-0">{item.icon || '📌'}</span>
                  {!collapsed && (
                    <span className="text-lg font-medium">{item.label}</span>
                  )}
                </button>
              ))}
            </div>

            {/* 구분선 */}
            <div className={`border-t border-gray-200 ${collapsed ? 'my-4' : 'my-6'}`} />

            {/* 외부 링크 */}
            <div className="space-y-2">
              {EXTERNAL_LINKS.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  target={link.target}
                  rel="noopener noreferrer"
                  className={`
                    w-full rounded-lg transition-all duration-200 text-left
                    flex items-center gap-3
                    ${collapsed ? 'md:justify-center md:px-2 md:py-3' : 'px-4 py-3'}
                    text-gray-600 hover:bg-purple-100 hover:text-purple-600
                  `}
                  title={collapsed ? link.label : ''}
                >
                  {link.icon && <span className="text-xl">{link.icon}</span>}
                  {!collapsed && (
                    <span className="text-lg font-medium">{link.label}</span>
                  )}
                </a>
              ))}
            </div>

            {/* 구분선 */}
            <div className={`border-t border-gray-200 ${collapsed ? 'my-4' : 'my-6'}`} />

            {/* 사용자 정보 및 로그아웃 */}
            <div className="space-y-2">
              {!collapsed && user && (
                <div className="px-4 py-2 text-sm text-gray-500 font-sans">
                  {user.email}
                </div>
              )}
              <button
                onClick={handleSignOut}
                className={`
                  w-full rounded-lg transition-all duration-200 text-left
                  flex items-center gap-3
                  ${collapsed ? 'md:justify-center md:px-2 md:py-3' : 'px-4 py-3'}
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

