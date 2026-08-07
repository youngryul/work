/** 냉장고 재료 이름 → 이모지 (부분 일치, 긴 키워드 우선) */
export const FRIDGE_ITEM_ICON_KEYWORDS = [
  { keywords: ['우유', '밀크', '두유', '요거트', '요구르트', '치즈', '버터'], emoji: '🥛' },
  { keywords: ['계란', '달걀', '에그'], emoji: '🥚' },
  { keywords: ['김치', '깍두기', '열무'], emoji: '🥬' },
  { keywords: ['배추', '상추', '양상추', '시금치', '케일', '청경채'], emoji: '🥬' },
  { keywords: ['당근', '무', '오이', '호박', '가지', '파프리카', '피망'], emoji: '🥕' },
  { keywords: ['토마토', '방울토마토'], emoji: '🍅' },
  { keywords: ['양파', '대파', '쪽파', '마늘', '생강'], emoji: '🧅' },
  { keywords: ['감자', '고구마', '토란'], emoji: '🥔' },
  { keywords: ['버섯', '표고', '느타리', '팽이'], emoji: '🍄' },
  { keywords: ['사과', '배', '포도', '딸기', '바나나', '오렌지', '귤', '복숭아', '수박', '참외', '키위', '망고'], emoji: '🍎' },
  { keywords: ['소고기', '돼지고기', '닭고기', '닭', '삼겹', '목살', '갈비', '베이컨', '햄', '소시지', '고기'], emoji: '🥩' },
  { keywords: ['생선', '고등어', '연어', '참치', '새우', '오징어', '문어', '조개', '해물'], emoji: '🐟' },
  { keywords: ['두부', '순두부', '유부'], emoji: '🧈' },
  { keywords: ['밥', '쌀', '현미', '잡곡'], emoji: '🍚' },
  { keywords: ['면', '라면', '국수', '파스타', '우동', '소면'], emoji: '🍜' },
  { keywords: ['빵', '토스트', '식빵', '베이글'], emoji: '🍞' },
  { keywords: ['계란말이', '반찬', '나물'], emoji: '🍱' },
  { keywords: ['주스', '음료', '콜라', '사이다', '맥주', '와인', '소주', '커피', '차'], emoji: '🧃' },
  { keywords: ['아이스크림', '빙수', '냉동'], emoji: '🍦' },
  { keywords: ['피자', '만두', '치킨', '튀김'], emoji: '🍕' },
  { keywords: ['소스', '케첩', '마요네즈', '간장', '된장', '고추장', '잼', '꿀'], emoji: '🫙' },
  { keywords: ['오일', '기름', '참기름', '식용유'], emoji: '🫒' },
  { keywords: ['과자', '초콜릿', '쿠키', '스낵'], emoji: '🍪' },
  { keywords: ['견과', '아몬드', '호두'], emoji: '🥜' },
  { keywords: ['계란', '달걀'], emoji: '🥚' },
]

export const FRIDGE_ITEM_DEFAULT_EMOJI = '🥗'

/**
 * @param {string} name
 * @param {{ emoji?: string|null, imageUrl?: string|null, image_url?: string|null }|null} [catalogMatch]
 * @returns {{ emoji: string, imageUrl: string|null }}
 */
export function resolveFridgeItemIcon(name, catalogMatch = null) {
  const catalogEmoji = catalogMatch?.emoji?.trim()
  const catalogImage =
    catalogMatch?.imageUrl || catalogMatch?.image_url || null

  if (catalogImage || catalogEmoji) {
    return {
      emoji: catalogEmoji || FRIDGE_ITEM_DEFAULT_EMOJI,
      imageUrl: catalogImage || null,
    }
  }

  const normalized = (name || '').trim().toLowerCase()
  if (!normalized) {
    return { emoji: FRIDGE_ITEM_DEFAULT_EMOJI, imageUrl: null }
  }

  for (const entry of FRIDGE_ITEM_ICON_KEYWORDS) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return { emoji: entry.emoji, imageUrl: null }
    }
  }

  return { emoji: FRIDGE_ITEM_DEFAULT_EMOJI, imageUrl: null }
}

/**
 * 카탈로그 배열에서 이름 일치 항목 찾기
 * @param {string} name
 * @param {Array<{ name?: string, emoji?: string, image_url?: string }>} catalog
 * @returns {object|null}
 */
export function findCatalogMatchForFridgeItem(name, catalog = []) {
  const key = (name || '').trim().toLowerCase()
  if (!key || !Array.isArray(catalog) || catalog.length === 0) return null
  return (
    catalog.find((row) => (row.name || '').trim().toLowerCase() === key) || null
  )
}
