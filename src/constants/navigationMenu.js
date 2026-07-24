/**
 * 네비게이션 메뉴 설정
 * 3단계: 그룹 → 메뉴 → (선택) 하위 메뉴
 */

/**
 * 사이드바에 표시하지 않는 최상위 메뉴 id (뷰 전환·localStorage 등은 그대로 동작)
 */
export const SIDEBAR_HIDDEN_MENU_ITEM_IDS = new Set([
  'goals',
  'travel-menu',
  'food-calorie',
])

/** @deprecated 페이지 타이틀 호환용 — 사이드바는 이모지 사용 */
export const MENU_ICON_PATHS = {
  today: '✅',
  backlog: '📋',
  todoCalendar: '📅',
  diaryCalendar: '📔',
}

/** 일상 */
const DAILY_MENU_ITEMS = [
  { id: 'today', label: '오늘', icon: '✅' },
  { id: 'backlog', label: '백로그', icon: '📋' },
  { id: 'routines', label: '루틴', icon: '🔁' },
  { id: 'todo-calendar', label: '할 일 달력', icon: '📅' },
  { id: 'diary-calendar', label: '일기 달력', icon: '📔' },
  { id: 'schedule-calendar', label: '일정 달력', icon: '🗓️' },
  {
    id: 'timers',
    label: '타이머',
    icon: '⏱️',
    children: [
      { id: 'pomodoro', label: '뽀모도로', icon: '🍅' },
      { id: 'study-timer', label: '공부 타이머', icon: '⏳' },
      { id: 'study-time', label: '공부 통계', icon: '📊' },
    ],
  },
  { id: 'summer-clock', label: '시계', icon: '🕐' },
]

/** 기록·라이프 */
const LIFE_MENU_ITEMS = [
  { id: 'records', label: '프로젝트 기록', icon: '📁' },
  { id: 'goals', label: '2026 목표', icon: '🎯' },
  { id: 'habit-tracker', label: '습관 트래커', icon: '📌' },
  { id: 'bucketlist', label: '버킷리스트', icon: '🪣' },
  { id: 'reading', label: '독서', icon: '📚' },
  { id: 'five-year-questions', label: '5년 질문', icon: '📖' },
  { id: 'food-calorie', label: '음식 칼로리', icon: '🍽️' },
  { id: 'weight-tracking', label: '몸무게 기록', icon: '⚖️' },
  { id: 'congratulatory-money', label: '경조사 기록', icon: '💐' },
  { id: 'fridge-inventory', label: '냉장고 관리', icon: '🧊' },
  { id: 'recipes', label: '레시피', icon: '🍳' },
  { id: 'toeic-vocab', label: '토익 단어', icon: '📗' },
  { id: 'stocks', label: '주식 확인', icon: '📈' },
  {
    id: 'travel-menu',
    label: '여행',
    icon: '✈️',
    children: [
      { id: 'travel', label: '세계 여행 기록', icon: '🌍' },
      { id: 'domestic-travel', label: '국내 여행 기록', icon: '🗺️' },
      { id: 'travel-itinerary', label: '여행 일정', icon: '🧳' },
    ],
  },
  {
    id: 'review-menu',
    label: '회고',
    icon: '📝',
    children: [
      { id: 'review', label: '2025 회고', icon: '📊' },
      { id: 'review-2026', label: '2026 회고', icon: '🖊️' },
    ],
  },
]

/** 포실이·놀이 */
const POSILY_MENU_ITEMS = [
  { id: 'farm', label: '포실이 성장', icon: '🐣' },
  { id: 'farm-field', label: '농장', icon: '🌾' },
  { id: 'gacha', label: '뽑기 가챠', icon: '🎰' },
  { id: 'shop', label: '상점', icon: '🛒' },
  {
    id: 'games',
    label: '게임',
    icon: '🎮',
    children: [
      { id: 'nonogram', label: '네모 로직', icon: '🧩' },
      { id: 'sudoku', label: '스도쿠', icon: '🔢' },
    ],
  },
]

/** 하단 고정 메뉴 */
export const NAVIGATION_FOOTER_ITEMS = [
  { id: 'announcements', label: '공지사항', icon: '📢' },
  { id: 'my-page', label: '마이페이지', icon: '👤' },
  { id: 'settings', label: '설정', icon: '⚙️' },
]

/**
 * 사이드바 3단 그룹 (같은 성격끼리 묶음)
 */
export const NAVIGATION_MENU_GROUPS = [
  { id: 'daily', label: '일상', icon: '☀️', items: DAILY_MENU_ITEMS },
  { id: 'life', label: '기록', icon: '📔', items: LIFE_MENU_ITEMS },
  { id: 'posily', label: '포실이', icon: '🐣', items: POSILY_MENU_ITEMS },
]

/**
 * 평탄화된 전체 메뉴 (권한·뷰 조회용)
 */
export const NAVIGATION_MENU_ITEMS = [
  ...DAILY_MENU_ITEMS,
  ...LIFE_MENU_ITEMS,
  ...POSILY_MENU_ITEMS,
  ...NAVIGATION_FOOTER_ITEMS,
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
