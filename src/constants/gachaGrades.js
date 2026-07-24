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
 * 등급별 뽑기 승수 (draw_gacha_character SQL과 동일해야 함)
 * 캐릭터 수가 같다면 대략 일반 32% / 레어 28% / 에픽 25% / 레전드 15%
 */
export const GACHA_GRADE_DRAW_WEIGHT = {
  common: 32,
  rare: 28,
  epic: 25,
  legendary: 15,
}

/** 캐릭터 등록 시 등급별 기본 drop_weight (등급 승수와 이중 페널티 방지용으로 동일) */
export const GACHA_GRADE_DEFAULT_DROP_WEIGHT = {
  common: 100,
  rare: 100,
  epic: 100,
  legendary: 100,
}

/**
 * @param {string} gradeId
 * @returns {typeof GACHA_GRADES[number]}
 */
export function getGachaGradeMeta(gradeId) {
  return GACHA_GRADE_MAP[gradeId] ?? GACHA_GRADES[0]
}
