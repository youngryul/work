/** 포실이 꾸미기 부위 id (decor_items.slot CHECK와 동일) */
export const DECOR_SLOTS = {
  BACKGROUND: 'background',
  FRAME: 'frame',
}

/**
 * 꾸미기 부위 정의 — 배열 순서가 화면 탭 순서
 * @type {Array<{ id: string, label: string, icon: string, description: string, uploadHint: string }>}
 */
export const DECOR_SLOT_OPTIONS = [
  {
    id: DECOR_SLOTS.BACKGROUND,
    label: '배경',
    icon: '🖼️',
    description: '포실이 뒤에 깔리는 배경이에요.',
    uploadHint: '정사각형 이미지 권장 (JPEG·PNG)',
  },
  {
    id: DECOR_SLOTS.FRAME,
    label: '액자',
    icon: '🪞',
    description: '포실이 위에 겹쳐지는 테두리예요.',
    uploadHint: '가운데가 비어 있는 투명 PNG, 정사각형 권장',
  },
]

/** @type {Record<string, typeof DECOR_SLOT_OPTIONS[number]>} */
export const DECOR_SLOT_MAP = Object.fromEntries(DECOR_SLOT_OPTIONS.map((s) => [s.id, s]))

/** 착용 상태 변경 시 다른 화면의 아바타를 바로 갱신하기 위한 이벤트 */
export const POSILI_LOADOUT_UPDATED_EVENT = 'posiliLoadoutUpdated'

/** 관리자 이미지 업로드 폴더 */
export const DECOR_IMAGE_FOLDER = 'decor-items'

/** 아무것도 착용하지 않은 상태 */
export const EMPTY_POSILI_LOADOUT = {
  [DECOR_SLOTS.BACKGROUND]: null,
  [DECOR_SLOTS.FRAME]: null,
}
