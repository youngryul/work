/**
 * 일기 감정 정의: 키 → 한국어 라벨 + 감정을 떠올리게 하는 빛 색상
 * (달력 날짜 테두리에 빛처럼 번지는 색으로 사용)
 */
export const DIARY_EMOTIONS = {
  happiness: { label: '행복', color: '#FACC15' }, // 햇살 같은 노랑
  excitement: { label: '설렘', color: '#FB7185' }, // 두근거리는 코랄 핑크
  surprise: { label: '놀람', color: '#E879F9' }, // 번쩍이는 자홍빛
  love: { label: '사랑', color: '#EC4899' }, // 장밋빛 분홍
  gratitude: { label: '감사', color: '#F59E0B' }, // 따뜻한 호박빛 금색
  pride: { label: '뿌듯함', color: '#FB923C' }, // 노을 같은 주황
  satisfaction: { label: '만족', color: '#84CC16' }, // 잘 익은 연두
  hope: { label: '희망', color: '#2DD4BF' }, // 새벽빛 청록
  calm: { label: '평온', color: '#7DD3FC' }, // 맑은 하늘색
  peace: { label: '평화', color: '#A5F3FC' }, // 잔잔한 물빛
  comfort: { label: '편안', color: '#86EFAC' }, // 부드러운 풀빛
  relief: { label: '안도', color: '#67E8F9' }, // 숨이 트이는 아쿠아
  determination: { label: '의지', color: '#6366F1' }, // 단단한 남색
  nostalgia: { label: '그리움', color: '#D4A373' }, // 빛바랜 세피아
  embarrassment: { label: '부끄러움', color: '#F9A8D4' }, // 볼 빨간 분홍
  envy: { label: '부러움', color: '#22C55E' }, // 초록빛 질투
  confusion: { label: '혼란', color: '#C4B5FD' }, // 흐릿한 연보라
  anxiety: { label: '불안', color: '#A78BFA' }, // 일렁이는 보라
  tiredness: { label: '피곤', color: '#A8A29E' }, // 해 질 녘 잿빛
  loneliness: { label: '외로움', color: '#94A3B8' }, // 쓸쓸한 청회색
  sadness: { label: '슬픔', color: '#3B82F6' }, // 깊은 파랑
  disappointment: { label: '실망', color: '#64748B' }, // 가라앉은 회남색
  frustration: { label: '답답', color: '#B45309' }, // 탁한 갈색 주황
  anger: { label: '화남', color: '#DC2626' }, // 타오르는 빨강
}

/** 감정 키 → 한국어 라벨 */
export const DIARY_EMOTION_LABELS = Object.fromEntries(
  Object.entries(DIARY_EMOTIONS).map(([key, { label }]) => [key, label]),
)

/** AI가 돌려주는 다양한 영어 감정 단어 → 감정 키 */
const EMOTION_SYNONYMS = {
  happy: 'happiness', joy: 'happiness', joyful: 'happiness', glad: 'happiness',
  cheerful: 'happiness', delight: 'happiness', delighted: 'happiness', fun: 'happiness',
  excited: 'excitement', thrill: 'excitement', thrilled: 'excitement',
  anticipation: 'excitement', flutter: 'excitement', playful: 'excitement',
  curious: 'excitement', curiosity: 'excitement',
  surprised: 'surprise', amazed: 'surprise', amazement: 'surprise', astonished: 'surprise',
  shock: 'surprise', shocked: 'surprise', wonder: 'surprise', awe: 'surprise',
  loved: 'love', affection: 'love', romantic: 'love', romance: 'love',
  grateful: 'gratitude', thankful: 'gratitude', thankfulness: 'gratitude', appreciation: 'gratitude',
  proud: 'pride', accomplishment: 'pride', achievement: 'pride', accomplished: 'pride',
  satisfied: 'satisfaction', content: 'satisfaction', contentment: 'satisfaction',
  fulfilled: 'satisfaction', fulfillment: 'satisfaction',
  hopeful: 'hope', optimism: 'hope', optimistic: 'hope',
  calmness: 'calm', serene: 'calm', serenity: 'calm',
  peaceful: 'peace', tranquil: 'peace', tranquility: 'peace',
  comfortable: 'comfort', cozy: 'comfort', relaxed: 'comfort', relaxation: 'comfort', warmth: 'comfort',
  relieved: 'relief',
  determined: 'determination', motivated: 'determination', motivation: 'determination', resolve: 'determination',
  nostalgic: 'nostalgia', longing: 'nostalgia', missing: 'nostalgia', yearning: 'nostalgia',
  bittersweet: 'nostalgia', pensive: 'nostalgia', reflective: 'nostalgia', thoughtful: 'nostalgia',
  embarrassed: 'embarrassment', shy: 'embarrassment', shame: 'embarrassment', awkward: 'embarrassment',
  envious: 'envy', jealous: 'envy', jealousy: 'envy',
  confused: 'confusion', bewildered: 'confusion',
  anxious: 'anxiety', worry: 'anxiety', worried: 'anxiety', nervous: 'anxiety',
  stress: 'anxiety', stressed: 'anxiety', fear: 'anxiety', afraid: 'anxiety',
  scared: 'anxiety', overwhelmed: 'anxiety', nervousness: 'anxiety',
  tired: 'tiredness', exhausted: 'tiredness', exhaustion: 'tiredness', fatigue: 'tiredness',
  sleepy: 'tiredness', bored: 'tiredness', boredom: 'tiredness',
  lonely: 'loneliness', empty: 'loneliness', emptiness: 'loneliness',
  sad: 'sadness', sorrow: 'sadness', grief: 'sadness', melancholy: 'sadness', gloomy: 'sadness',
  hurt: 'sadness', depressed: 'sadness',
  disappointed: 'disappointment', regret: 'disappointment', guilt: 'disappointment', guilty: 'disappointment',
  frustrated: 'frustration', annoyed: 'frustration', annoyance: 'frustration',
  irritated: 'frustration', irritation: 'frustration', upset: 'frustration',
  angry: 'anger', rage: 'anger', mad: 'anger', furious: 'anger',
}

/** 한국어 라벨로 저장된 값도 키로 되돌리기 위한 역방향 맵 */
const LABEL_TO_KEY = Object.fromEntries(
  Object.entries(DIARY_EMOTIONS).map(([key, { label }]) => [label, key]),
)

/**
 * 저장된 감정 값(영어 단어·대소문자 섞임·한국어 라벨)을 감정 키로 정규화
 * @param {string | null | undefined} rawEmotion
 * @returns {string | null}
 */
export function normalizeDiaryEmotion(rawEmotion) {
  if (!rawEmotion) return null
  const trimmed = String(rawEmotion).trim()
  if (LABEL_TO_KEY[trimmed]) return LABEL_TO_KEY[trimmed]
  const word = trimmed.toLowerCase()
  if (DIARY_EMOTIONS[word]) return word
  return EMOTION_SYNONYMS[word] ?? null
}

/**
 * @param {string | null | undefined} emotionKey
 * @returns {string | undefined}
 */
export function getDiaryEmotionLabel(emotionKey) {
  if (!emotionKey) return undefined
  const key = normalizeDiaryEmotion(emotionKey)
  return key ? DIARY_EMOTIONS[key].label : emotionKey
}

/**
 * 감정의 빛 색상 (알 수 없는 감정이면 null)
 * @param {string | null | undefined} emotionKey
 * @returns {string | null}
 */
export function getDiaryEmotionColor(emotionKey) {
  const key = normalizeDiaryEmotion(emotionKey)
  return key ? DIARY_EMOTIONS[key].color : null
}
