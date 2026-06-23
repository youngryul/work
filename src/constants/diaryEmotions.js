/** 일기 감정 키 → 한국어 라벨 */
export const DIARY_EMOTION_LABELS = {
  calm: '평온',
  comfort: '편안',
  happiness: '행복',
  sadness: '슬픔',
  anxiety: '불안',
  loneliness: '외로움',
  hope: '희망',
  tiredness: '피곤',
  excitement: '설렘',
  gratitude: '감사',
  nostalgia: '그리움',
  frustration: '답답',
  relief: '안도',
  pride: '뿌듯함',
  embarrassment: '부끄러움',
  envy: '부러움',
  determination: '의지',
  confusion: '혼란',
  peace: '평화',
  love: '사랑',
  anger: '화남',
  disappointment: '실망',
  satisfaction: '만족',
}

/**
 * @param {string | null | undefined} emotionKey
 * @returns {string | undefined}
 */
export function getDiaryEmotionLabel(emotionKey) {
  if (!emotionKey) return undefined
  return DIARY_EMOTION_LABELS[emotionKey] ?? emotionKey
}
