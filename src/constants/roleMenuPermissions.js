import {
  EXTERNAL_LINKS,
  NAVIGATION_MENU_ITEMS,
  SIDEBAR_HIDDEN_MENU_ITEM_IDS,
} from './navigationMenu.js'

/** 역할 키 */
export const USER_ROLES = ['admin', 'superuser', 'regular']

/** 역할 표시명 */
export const USER_ROLE_LABELS = {
  admin: '관리자',
  superuser: '슈퍼유저',
  regular: '일반',
}

/**
 * 설정 가능한 모든 메뉴 id 수집 (부모·자식·푸터·외부링크)
 * @returns {string[]}
 */
export function collectAllConfigurableMenuIds() {
  const ids = new Set()
  NAVIGATION_MENU_ITEMS.forEach((item) => {
    ids.add(item.id)
    item.children?.forEach((child) => ids.add(child.id))
  })
  EXTERNAL_LINKS.forEach((link) => ids.add(link.id))
  return [...ids]
}

/**
 * 메뉴 id → 라벨 맵
 * @returns {Record<string, string>}
 */
export function buildMenuLabelMap() {
  /** @type {Record<string, string>} */
  const map = {}
  NAVIGATION_MENU_ITEMS.forEach((item) => {
    map[item.id] = item.label
    item.children?.forEach((child) => {
      map[child.id] = `${item.label} › ${child.label}`
    })
  })
  EXTERNAL_LINKS.forEach((link) => {
    map[link.id] = link.label
  })
  map.admin = '관리자 대시보드'
  return map
}

/** 관리자·슈퍼유저 기본: 사이드바에 노출 가능한 전체 메뉴 */
const FULL_MAIN_MENU_IDS = NAVIGATION_MENU_ITEMS.filter(
  (item) => !['announcements', 'my-page', 'settings'].includes(item.id),
).flatMap((item) => {
  const ids = [item.id]
  if (item.children) ids.push(...item.children.map((c) => c.id))
  return ids
})

const DEFAULT_FOOTER_MENU_IDS = ['announcements', 'my-page', 'settings']
const DEFAULT_EXTERNAL_LINK_IDS = EXTERNAL_LINKS.map((l) => l.id)

/**
 * 역할별 기본 메뉴 권한 (현재 앱 동작 기준)
 * @type {Record<string, { allowedMenuIds: string[], allowedFooterMenuIds: string[], allowedExternalLinkIds: string[], showAdminMenu: boolean }>}
 */
export const DEFAULT_ROLE_MENU_PERMISSIONS = {
  regular: {
    allowedMenuIds: [
      'today',
      'backlog',
      'todo-calendar',
      'diary-calendar',
      'gacha',
      'farm',
      'farm-field',
      'shop',
      'stocks',
    ],
    allowedFooterMenuIds: [...DEFAULT_FOOTER_MENU_IDS],
    allowedExternalLinkIds: [],
    showAdminMenu: false,
  },
  superuser: {
    allowedMenuIds: [...FULL_MAIN_MENU_IDS],
    allowedFooterMenuIds: [...DEFAULT_FOOTER_MENU_IDS],
    allowedExternalLinkIds: [...DEFAULT_EXTERNAL_LINK_IDS],
    showAdminMenu: false,
  },
  admin: {
    allowedMenuIds: [...FULL_MAIN_MENU_IDS],
    allowedFooterMenuIds: [...DEFAULT_FOOTER_MENU_IDS],
    allowedExternalLinkIds: [...DEFAULT_EXTERNAL_LINK_IDS],
    showAdminMenu: true,
  },
}

/**
 * 관리자 UI용 메뉴 그룹
 */
export const ROLE_MENU_CONFIG_GROUPS = [
  {
    title: '할 일·일기',
    menuIds: ['today', 'backlog', 'todo-calendar', 'diary-calendar', 'gacha', 'farm', 'farm-field', 'shop', 'stocks', 'schedule-calendar'],
  },
  {
    title: '기록·목표',
    menuIds: [
      'records',
      'goals',
      'habit-tracker',
      'bucketlist',
      'reading',
      'five-year-questions',
      'food-calorie',
      'weight-tracking',
      'congratulatory-money',
      'fridge-inventory',
      'toeic-vocab',
    ],
  },
  {
    title: '여행',
    menuIds: ['travel-menu', 'travel', 'domestic-travel', 'travel-itinerary'],
  },
  {
    title: '게임',
    menuIds: ['games', 'nonogram', 'sudoku'],
  },
  {
    title: '시계',
    menuIds: ['summer-clock'],
  },
  {
    title: '회고',
    menuIds: ['review-menu', 'review', 'review-2026'],
  },
  {
    title: '하단 메뉴',
    menuIds: DEFAULT_FOOTER_MENU_IDS,
    footer: true,
  },
  {
    title: '외부 링크',
    menuIds: DEFAULT_EXTERNAL_LINK_IDS,
    external: true,
  },
  {
    title: '관리',
    menuIds: ['admin'],
    adminOnly: true,
  },
]

/**
 * @param {string} role
 * @returns {typeof DEFAULT_ROLE_MENU_PERMISSIONS.regular}
 */
export function getDefaultPermissionsForRole(role) {
  return (
    DEFAULT_ROLE_MENU_PERMISSIONS[role] ?? DEFAULT_ROLE_MENU_PERMISSIONS.regular
  )
}

/**
 * 사이드바 상단 메뉴 노출 여부
 * @param {string} itemId
 * @param {Set<string>} allowedMenuIds
 * @param {{ children?: Array<{ id: string }> }} [item]
 */
export function isMainMenuItemAllowed(itemId, allowedMenuIds, item) {
  if (SIDEBAR_HIDDEN_MENU_ITEM_IDS.has(itemId)) {
    if (item?.children?.length) {
      return item.children.some((child) => allowedMenuIds.has(child.id))
    }
    return allowedMenuIds.has(itemId)
  }
  if (allowedMenuIds.has(itemId)) return true
  if (item?.children?.length) {
    return item.children.some((child) => allowedMenuIds.has(child.id))
  }
  return false
}
