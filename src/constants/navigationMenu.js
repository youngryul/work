/**
 * 네비게이션 메뉴 설정
 * 메뉴 항목을 중앙에서 관리하여 확장성 향상
 */

export const NAVIGATION_MENU_ITEMS = [
  {
    id: 'today',
    label: '오늘',
    icon: '📅',
  },
  {
    id: 'backlog',
    label: '백로그',
    icon: '📋',
  },
  {
    id: 'todo-calendar',
    label: '할 일 달력',
    icon: '✅',
  },
  {
    id: 'diary-calendar',
    label: '일기 달력',
    icon: '📔',
  },
  {
    id: 'records',
    label: '프로젝트 기록',
    icon: '📁',
  },
  {
    id: 'goals',
    label: '2026 목표',
    icon: '🎯',
  },
  {
    id: 'bucketlist',
    label: '버킷리스트',
    icon: '🪣',
  },
  {
    id: 'reading',
    label: '독서',
    icon: '📚',
  },
  {
    id: 'travel-menu',
    label: '여행',
    icon: '✈️',
    children: [
      {
        id: 'travel',
        label: '세계 여행 기록',
        icon: '🌍',
      },
      {
        id: 'domestic-travel',
        label: '국내 여행 기록',
        icon: '🗺️',
      },
    ],
  },
  {
    id: 'five-year-questions',
    label: '5년 질문',
    icon: '📖',
  },
  {
    id: 'food-calorie',
    label: '음식 칼로리',
    icon: '🍽️',
  },
  {
    id: 'congratulatory-money',
    label: '경조사 기록',
    icon: '💐',
  },
  {
    id: 'announcements',
    label: '공지사항',
    icon: '📢',
  },
  {
    id: 'settings',
    label: '설정',
    icon: '⚙️',
  },
  {
    id: 'games',
    label: '게임',
    icon: '🎮',
    children: [
      {
        id: 'nonogram',
        label: '네모 로직',
        icon: '🧩',
      },
      {
        id: 'sudoku',
        label: '스도쿠',
        icon: '🔢',
      },
    ],
  },
  {
    id: 'review',
    label: '2025 회고',
    icon: '📊',
  },
  {
    id: 'review-2026',
    label: '2026 회고',
    icon: '📝',
  },
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

