import { NAVIGATION_MENU_ITEMS } from '../constants/navigationMenu.js'
import {
  EXCEL_UI_COLORS,
  EXCEL_MENU_TABS,
  EXCEL_RIBBON_GROUPS,
} from '../constants/excelThemeUi.js'

/**
 * 메뉴 id에 해당하는 화면 이름 반환
 * @param {string} viewId
 * @returns {string}
 */
function getViewLabel(viewId) {
  for (const item of NAVIGATION_MENU_ITEMS) {
    if (item.id === viewId) return item.label
    if (item.children) {
      const child = item.children.find((c) => c.id === viewId)
      if (child) return child.label
    }
  }
  if (viewId === 'admin') return '관리자'
  return '통합 문서'
}

/**
 * 엑셀 테마 상단 UI (타이틀 바 · 탭 · 리본 · 수식 입력줄)
 * @param {{ currentView: string }} props
 */
export default function ExcelThemeHeader({ currentView }) {
  const viewLabel = getViewLabel(currentView)
  const documentTitle = `${viewLabel} - Posily`

  return (
    <div
      className="excel-theme-header sticky top-0 z-40 border-b shadow-sm"
      style={{ borderColor: EXCEL_UI_COLORS.ribbonBorder }}
    >
      {/* 타이틀 바 */}
      <div
        className="flex items-center justify-between gap-2 px-2 md:px-3 h-9 text-sm"
        style={{ backgroundColor: EXCEL_UI_COLORS.titleBar, color: EXCEL_UI_COLORS.textOnGreen }}
      >
        <div className="flex items-center gap-1 min-w-0">
          <div className="hidden sm:flex items-center gap-0.5 pr-2 border-r border-white/20">
            <span className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10" title="저장">💾</span>
            <span className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10" title="실행 취소">↩</span>
            <span className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10" title="다시 실행">↪</span>
          </div>
          <span className="truncate font-medium pl-1">{documentTitle}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs">
          <span className="hidden md:inline px-2 py-0.5 border border-white/40 rounded">로그인</span>
          <span className="hidden lg:flex items-center gap-1 px-2 py-0.5 border border-white/40 rounded">
            <span>👤</span> 공유
          </span>
        </div>
      </div>

      {/* 메뉴 탭 */}
      <div
        className="flex items-end gap-0 overflow-x-auto scrollbar-hide px-1"
        style={{ backgroundColor: EXCEL_UI_COLORS.titleBar }}
      >
        {EXCEL_MENU_TABS.map((tab) => {
          const isActive = tab === '홈'
          return (
            <div
              key={tab}
              className={`shrink-0 px-3 py-1.5 text-xs md:text-sm rounded-t transition-colors ${
                isActive
                  ? 'bg-white font-medium'
                  : 'text-white/95 hover:bg-white/10'
              }`}
              style={isActive ? { color: EXCEL_UI_COLORS.titleBar } : undefined}
            >
              {tab}
            </div>
          )
        })}
      </div>

      {/* 리본 */}
      <div
        className="hidden md:flex items-stretch overflow-x-auto border-b"
        style={{
          backgroundColor: EXCEL_UI_COLORS.ribbonBg,
          borderColor: EXCEL_UI_COLORS.ribbonBorder,
        }}
      >
        {EXCEL_RIBBON_GROUPS.map((group) => (
          <div
            key={group.label}
            className="flex flex-col justify-between px-2 py-1.5 border-r min-w-[72px]"
            style={{ borderColor: EXCEL_UI_COLORS.ribbonBorder }}
          >
            <div className="flex items-center gap-1 flex-1">
              {group.items.map((item, index) => {
                if (item.type === 'font') {
                  return (
                    <div key={index} className="flex flex-col gap-1">
                      <div
                        className="px-2 py-0.5 text-xs border rounded bg-white min-w-[88px]"
                        style={{ borderColor: EXCEL_UI_COLORS.ribbonBorder, color: EXCEL_UI_COLORS.textDark }}
                      >
                        {item.label}
                      </div>
                      <div
                        className="px-2 py-0.5 text-xs border rounded bg-white w-10 text-center"
                        style={{ borderColor: EXCEL_UI_COLORS.ribbonBorder, color: EXCEL_UI_COLORS.textDark }}
                      >
                        {item.size}
                      </div>
                    </div>
                  )
                }
                if (item.type === 'dropdown') {
                  return (
                    <div
                      key={index}
                      className="px-2 py-1 text-xs border rounded bg-white"
                      style={{ borderColor: EXCEL_UI_COLORS.ribbonBorder, color: EXCEL_UI_COLORS.textDark }}
                    >
                      {item.label} ▾
                    </div>
                  )
                }
                if (item.large) {
                  return (
                    <div key={index} className="flex flex-col items-center px-1">
                      <span className="text-xl leading-none">{item.icon}</span>
                      <span className="text-[10px] mt-0.5" style={{ color: EXCEL_UI_COLORS.textDark }}>
                        {item.label}
                      </span>
                    </div>
                  )
                }
                return (
                  <div
                    key={index}
                    className="w-7 h-7 flex items-center justify-center text-xs border rounded bg-white hover:bg-gray-50"
                    style={{ borderColor: EXCEL_UI_COLORS.ribbonBorder, color: EXCEL_UI_COLORS.textDark }}
                    title={item.label}
                  >
                    {item.icon}
                  </div>
                )
              })}
            </div>
            <span
              className="text-[10px] text-center pt-1"
              style={{ color: '#605e5c' }}
            >
              {group.label}
            </span>
          </div>
        ))}
      </div>

      {/* 수식 입력줄 + 열 머리글 */}
      <div style={{ backgroundColor: EXCEL_UI_COLORS.ribbonBg }}>
        <div
          className="flex items-center gap-1 px-2 py-1 border-b"
          style={{ borderColor: EXCEL_UI_COLORS.ribbonBorder }}
        >
          <div
            className="w-10 h-6 flex items-center justify-center text-xs border rounded bg-white shrink-0"
            style={{ borderColor: EXCEL_UI_COLORS.ribbonBorder, color: EXCEL_UI_COLORS.textDark }}
          >
            A1
          </div>
          <div
            className="hidden sm:flex w-8 h-6 items-center justify-center text-[10px] italic border rounded bg-white shrink-0"
            style={{ borderColor: EXCEL_UI_COLORS.ribbonBorder, color: '#605e5c' }}
          >
            fx
          </div>
          <div
            className="flex-1 h-6 border rounded bg-white"
            style={{ borderColor: EXCEL_UI_COLORS.ribbonBorder }}
          />
        </div>
        <div
          className="flex items-center h-5 overflow-x-auto"
          style={{ backgroundColor: EXCEL_UI_COLORS.columnHeader }}
        >
          <div className="w-10 h-full shrink-0 border-r" style={{ borderColor: EXCEL_UI_COLORS.ribbonBorder }} />
          {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map((col) => (
            <div
              key={col}
              className="min-w-[48px] h-full flex items-center justify-center text-[11px] border-r shrink-0"
              style={{
                borderColor: EXCEL_UI_COLORS.ribbonBorder,
                color: EXCEL_UI_COLORS.textDark,
              }}
            >
              {col}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
