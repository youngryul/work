/** 엑셀 테마 UI 색상 */
export const EXCEL_UI_COLORS = {
  titleBar: '#217346',
  titleBarDark: '#185c37',
  ribbonBg: '#f3f2f1',
  ribbonBorder: '#d4d4d4',
  columnHeader: '#e6e6e6',
  textOnGreen: '#ffffff',
  textDark: '#323130',
}

/** 엑셀 메뉴 탭 */
export const EXCEL_MENU_TABS = [
  '파일',
  '홈',
  '삽입',
  '페이지 레이아웃',
  '수식',
  '데이터',
  '검토',
  '보기',
  '도움말',
]

/** 리본 그룹 (장식용) */
export const EXCEL_RIBBON_GROUPS = [
  {
    label: '클립보드',
    items: [
      { icon: '📋', label: '붙여넣기', large: true },
      { icon: '✂', label: '잘라내기' },
      { icon: '📄', label: '복사' },
    ],
  },
  {
    label: '글꼴',
    items: [
      { type: 'font', label: '맑은 고딕', size: '11' },
      { icon: 'B', label: '굵게' },
      { icon: 'I', label: '기울임' },
      { icon: 'U', label: '밑줄' },
    ],
  },
  {
    label: '맞춤',
    items: [
      { icon: '≡', label: '왼쪽' },
      { icon: '☰', label: '가운데' },
      { icon: '≣', label: '오른쪽' },
      { icon: '⧉', label: '병합' },
    ],
  },
  {
    label: '표시 형식',
    items: [
      { type: 'dropdown', label: '일반' },
      { icon: '$', label: '통화' },
      { icon: '%', label: '백분율' },
    ],
  },
  {
    label: '스타일',
    items: [
      { icon: '▦', label: '조건부 서식' },
      { icon: '▤', label: '표 서식' },
    ],
  },
  {
    label: '편집',
    items: [
      { icon: 'Σ', label: '자동 합계' },
      { icon: '⇅', label: '정렬' },
      { icon: '🔍', label: '찾기' },
    ],
  },
]
