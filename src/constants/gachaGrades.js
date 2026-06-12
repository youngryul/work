/** 가챠 등급 정의 */

export const GACHA_GRADES = [

  { id: 'common', label: '일반', colorClass: 'bg-gray-100 text-gray-800 border-gray-300', ringClass: 'ring-gray-300' },

  { id: 'rare', label: '레어', colorClass: 'bg-blue-100 text-blue-800 border-blue-300', ringClass: 'ring-blue-400' },

  { id: 'epic', label: '에픽', colorClass: 'bg-purple-100 text-purple-800 border-purple-300', ringClass: 'ring-purple-400' },

  { id: 'legendary', label: '레전드', colorClass: 'bg-amber-100 text-amber-900 border-amber-400', ringClass: 'ring-amber-500' },

]



/** @type {Record<string, typeof GACHA_GRADES[number]>} */

export const GACHA_GRADE_MAP = Object.fromEntries(GACHA_GRADES.map((g) => [g.id, g]))



/** 등급별 기본 드롭 가중치 */

export const GACHA_GRADE_DEFAULT_DROP_WEIGHT = {

  common: 100,

  rare: 80,

  epic: 50,

  legendary: 20,

}



/**

 * @param {string} gradeId

 * @returns {typeof GACHA_GRADES[number]}

 */

export function getGachaGradeMeta(gradeId) {

  return GACHA_GRADE_MAP[gradeId] ?? GACHA_GRADES[0]

}


