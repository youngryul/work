/** 가챠 캡슐 디스플레이 이미지 (고정 3종) */
export const GACHA_CAPSULE_IMAGES = [
  '/images/캡슐파랑.png',
  '/images/캡슐노랑.png',
  '/images/캡슐빨강.png',
]

/** 가챠 등급 정의 */
export const GACHA_GRADES = [
  { id: 'common', label: '일반', colorClass: 'bg-gray-100 text-gray-800 border-gray-300', ringClass: 'ring-gray-300' },
  { id: 'rare', label: '레어', colorClass: 'bg-blue-100 text-blue-800 border-blue-300', ringClass: 'ring-blue-400' },
  { id: 'epic', label: '에픽', colorClass: 'bg-purple-100 text-purple-800 border-purple-300', ringClass: 'ring-purple-400' },
  { id: 'legendary', label: '레전드', colorClass: 'bg-amber-100 text-amber-900 border-amber-400', ringClass: 'ring-amber-500' },
]

/** @type {Record<string, typeof GACHA_GRADES[number]>} */
export const GACHA_GRADE_MAP = Object.fromEntries(GACHA_GRADES.map((g) => [g.id, g]))

/**
 * 등급별 뽑기 비율 (draw_gacha_character SQL과 동일)
 * 캐릭터 개별 가중치 없이, 등급만 뽑은 뒤 같은 등급 안에서 균등 선택
 */
export const GACHA_GRADE_DRAW_WEIGHT = {
  common: 32,
  rare: 28,
  epic: 25,
  legendary: 15,
}

/**
 * @param {string} gradeId
 * @returns {typeof GACHA_GRADES[number]}
 */
export function getGachaGradeMeta(gradeId) {
  return GACHA_GRADE_MAP[gradeId] ?? GACHA_GRADES[0]
}
