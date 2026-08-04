/** 포실이네컷 프레임 에셋 (원본 576×1024 JPEG) */
export const POSILI_FOURCUT_FRAME_URL = '/images/posili-fourcut-frame.jpg'

/** 원본 프레임 기준 흰 슬롯 좌표 (검출값, 살짝 inset) */
export const POSILI_FOURCUT_FRAME_SIZE = { width: 576, height: 1024 }

/**
 * @type {{ x: number, y: number, w: number, h: number, radius: number }[]}
 */
export const POSILI_FOURCUT_SLOTS = [
  { x: 170, y: 118, w: 236, h: 208, radius: 16 },
  { x: 169, y: 342, w: 236, h: 203, radius: 16 },
  { x: 169, y: 560, w: 236, h: 199, radius: 16 },
  { x: 169, y: 774, w: 236, h: 187, radius: 16 },
]

/** 저장·공유용 업스케일 (선명도) */
export const POSILI_FOURCUT_OUTPUT_SCALE = 2
