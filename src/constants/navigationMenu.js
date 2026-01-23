/**
 * 네비게이션 메뉴 설정
 * 메뉴 항목을 중앙에서 관리하여 확장성 향상
 */

// 기본 메뉴 (무료 사용자도 접근 가능)
export const BASIC_MENU_ITEMS = [
  {
    id: 'today',
    label: '오늘',
    icon: '📅',
    tier: 'free',
  },
  {
    id: 'backlog',
    label: '백로그',
    icon: '📋',
    tier: 'free',
  },
  {
    id: 'todo-calendar',
    label: '할 일 달력',
    icon: '✅',
    tier: 'free',
  },
  {
    id: 'diary-calendar',
    label: '일기 달력',
    icon: '📔',
    tier: 'free',
  },
]

// 베이직 구독 추가 메뉴 (2개)
export const BASIC_TIER_MENU_ITEMS = [
  {
    id: 'review',
    label: '2025 회고',
    icon: '📊',
    tier: 'basic',
  },
  {
    id: 'review-2026',
    label: '2026 회고',
    icon: '📝',
    tier: 'basic',
  },
]

// 프리미엄 구독 추가 메뉴 (4개)
export const PREMIUM_TIER_MENU_ITEMS = [
  {
    id: 'records',
    label: '프로젝트 기록',
    icon: '📁',
    tier: 'premium',
  },
  {
    id: 'goals',
    label: '2026 목표',
    icon: '🎯',
    tier: 'premium',
  },
  {
    id: 'bucketlist',
    label: '버킷리스트',
    icon: '🪣',
    tier: 'premium',
  },
  {
    id: 'reading',
    label: '독서',
    icon: '📚',
    tier: 'premium',
  },
]

// 프로 구독 추가 메뉴 (나머지 모든 기능)
export const PRO_TIER_MENU_ITEMS = [
  {
    id: 'travel',
    label: '여행',
    icon: '✈️',
    tier: 'pro',
  },
  {
    id: 'five-year-questions',
    label: '5년 질문',
    icon: '📖',
    tier: 'pro',
  },
  {
    id: 'food-calorie',
    label: '음식 칼로리',
    icon: '🍽️',
    tier: 'pro',
  },
  {
    id: 'congratulatory-money',
    label: '경조사 기록',
    icon: '💐',
    tier: 'pro',
  },
]

// 항상 접근 가능한 메뉴
export const ALWAYS_ACCESSIBLE_MENU_ITEMS = [
  {
    id: 'announcements',
    label: '공지사항',
    icon: '📢',
    tier: 'always',
  },
  {
    id: 'payment',
    label: '결제/구독',
    icon: '💳',
    tier: 'always',
  },
]

// 전체 메뉴 목록 (호환성을 위해 유지)
export const NAVIGATION_MENU_ITEMS = [
  ...BASIC_MENU_ITEMS,
  ...BASIC_TIER_MENU_ITEMS,
  ...PREMIUM_TIER_MENU_ITEMS,
  ...PRO_TIER_MENU_ITEMS,
  ...ALWAYS_ACCESSIBLE_MENU_ITEMS,
]

/**
 * 외부 링크 메뉴 항목
 */
export const EXTERNAL_LINKS = [
  {
    id: 'tarot',
    label: '타로(개발중)',
    icon: '🔮',
    href: 'https://taro-gwzj.vercel.app/',
    target: '_blank',
  },
  {
    id: 'money',
    label: '부부 가계부',
    icon: '💰',
    href: 'https://money-two-alpha.vercel.app/',
    target: '_blank',
  },
]

