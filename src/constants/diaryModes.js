/** 일기 작성 모드 */
export const DIARY_MODE = {
  /** 이미지 생성 없이 글만 저장 */
  NORMAL: 'normal',
  AI_FOUR_CUT: 'ai_four_cut',
  PHOTO_FOUR_CUT: 'photo_four_cut',
}

export const DIARY_MODE_LABELS = {
  [DIARY_MODE.AI_FOUR_CUT]: 'AI 4컷',
  [DIARY_MODE.PHOTO_FOUR_CUT]: '사진 4컷',
}

/** 폼 모드 탭에 표시할 모드 */
export const DIARY_FORM_MODES = [
  DIARY_MODE.AI_FOUR_CUT,
  DIARY_MODE.PHOTO_FOUR_CUT,
]

/** 사진 4컷 최대 장수 */
export const PHOTO_FOUR_CUT_MAX = 4

/** AI 4컷 장면 수 */
export const AI_FOUR_CUT_SCENE_COUNT = 4

/** 달력 대문 후보 최대 장수 (AI 장면 4 + AI 스트립 1 + 사진 4 + 사진 스트립 1) */
export const DIARY_COVER_CANDIDATE_MAX = 10
