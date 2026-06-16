/** 앱 테마 id */
export const APP_THEMES = {
  POSILY: 'posily',
  BLUE: 'blue',
  EXCEL: 'excel',
}

/** @type {Array<{ id: string, label: string, description: string }>} */
export const APP_THEME_OPTIONS = [
  {
    id: APP_THEMES.POSILY,
    label: '포실이 테마',
    description: '기존처럼 배경 이미지를 사용하는 감성 테마',
  },
  {
    id: APP_THEMES.BLUE,
    label: '파란색 테마',
    description: '이미지 없이 심플한 블루 톤 테마',
  },
  {
    id: APP_THEMES.EXCEL,
    label: '엑셀 테마',
    description: '회색 격자 배경과 엑셀 그린 포인트의 깔끔한 테마',
  },
]

/**
 * @param {string} theme
 * @returns {string}
 */
export function getThemeWrapperClass(theme) {
  if (theme === APP_THEMES.BLUE) return 'theme-blue'
  if (theme === APP_THEMES.EXCEL) return 'theme-excel'
  return 'theme-posily'
}

/**
 * 오늘 페이지 배경 이미지(todo.png) 표시 여부
 * @param {string} theme
 * @returns {boolean}
 */
export function shouldShowTodayBackgroundImage(theme) {
  return theme === APP_THEMES.POSILY
}

/**
 * 오늘 페이지 엑셀 격자 배경 표시 여부
 * @param {string} theme
 * @returns {boolean}
 */
export function shouldShowTodayExcelGrid(theme) {
  return theme === APP_THEMES.EXCEL
}
