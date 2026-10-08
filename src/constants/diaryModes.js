/** 일기 작성 모드 */
export const DIARY_MODE = {
  /** 이미지 생성 없이 글만 저장 */
  NORMAL: 'normal',
  AI_FOUR_CUT: 'ai_four_cut',
  /** 사진 첨부 (첨부하면 바로 자동 저장) */
  PHOTO: 'photo',
}

export const DIARY_MODE_LABELS = {
  [DIARY_MODE.AI_FOUR_CUT]: 'AI 4컷',
  [DIARY_MODE.PHOTO]: '사진 첨부',
}

/** 폼 모드 탭에 표시할 모드 */
export const DIARY_FORM_MODES = [
  DIARY_MODE.AI_FOUR_CUT,
  DIARY_MODE.PHOTO,
]

/** 첨부 사진 최대 장수 */
export const PHOTO_ATTACH_MAX = 10

/** AI 4컷 장면 수 */
export const AI_FOUR_CUT_SCENE_COUNT = 4

/** 달력 대문 후보 최대 장수 (AI 장면 4 + AI 스트립 1 + 첨부 사진 10) */
export const DIARY_COVER_CANDIDATE_MAX = 15
