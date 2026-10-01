import { loadImageBitmap, downloadImageBlob } from './imageBitmap.js'

const CANVAS_WIDTH = 1080
const PADDING_X = 60
const HEADER_HEIGHT = 230
const FOOTER_HEIGHT = 110
const GAP_X = 40
const GAP_Y = 64
const POLAROID_FRAME = 18
const CAPTION_AREA = 78
const FONT_FAMILY = '"SchoolSafeBoardMarker", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
const BRAND_LABEL = '포실이 · 여행 앨범'

/** 폴라로이드 기울기 (화면과 비슷한 느낌, 이미지에서는 조금 약하게) */
const ROTATIONS = [-4, 2, -2, 3, -3, 1, 4, -1]

/**
 * 사진 수에 맞는 열 개수
 * @param {number} count
 */
function getColumnCount(count) {
  if (count <= 1) return 1
  if (count <= 4) return 2
  return 3
}

/**
 * 폭에 맞춰 한 줄 텍스트 자르기
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 */
function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let trimmed = text
  while (trimmed.length > 0 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1)
  }
  return `${trimmed}…`
}

/**
 * 정사각형 영역에 이미지를 cover 방식으로 그리기
 * @param {CanvasRenderingContext2D} ctx
 * @param {ImageBitmap} bitmap
 * @param {number} x
 * @param {number} y
 * @param {number} size
 */
function drawCoverImage(ctx, bitmap, x, y, size) {
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2
  ctx.drawImage(bitmap, sx, sy, side, side, x, y, size, size)
}

/**
 * 여행 앨범 전체를 폴라로이드 콜라주 이미지(PNG)로 합성
 * @param {{ title: string, periodLabel?: string, photos: Array<{ id: string, imageUrl: string, caption?: string }> }} params
 * @returns {Promise<Blob>}
 */
export async function createTravelAlbumImageBlob({ title, periodLabel = '', photos }) {
  const validPhotos = (photos || []).filter((photo) => photo.imageUrl && !photo.isLocal)
  if (validPhotos.length === 0) {
    throw new Error('저장할 사진이 없습니다.')
  }

  // 손글씨 폰트가 로드된 뒤에 그려야 캔버스에 반영됨
  try {
    await document.fonts.load(`40px ${FONT_FAMILY}`)
  } catch {
    // 폰트 로드 실패 시 기본 폰트 사용
  }

  const bitmaps = await Promise.all(
    validPhotos.map((photo) => loadImageBitmap(photo.imageUrl).catch(() => null)),
  )

  const columns = getColumnCount(validPhotos.length)
  const rows = Math.ceil(validPhotos.length / columns)
  const cardWidth = (CANVAS_WIDTH - PADDING_X * 2 - GAP_X * (columns - 1)) / columns
  const imageSize = cardWidth - POLAROID_FRAME * 2
  const cardHeight = POLAROID_FRAME + imageSize + CAPTION_AREA
  const canvasHeight = HEADER_HEIGHT + rows * cardHeight + (rows - 1) * GAP_Y + FOOTER_HEIGHT + 40

  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_WIDTH
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmaps.forEach((bitmap) => bitmap?.close?.())
    throw new Error('앨범 이미지를 만들 수 없습니다.')
  }

  // 배경 (화면 앨범과 같은 톤)
  const background = ctx.createLinearGradient(0, 0, 0, canvasHeight)
  background.addColorStop(0, '#faf7f2')
  background.addColorStop(0.55, '#f4f1ea')
  background.addColorStop(1, '#eef2ea')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight)

  // 헤더: 무지개 그라데이션 제목 + 기간
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `64px ${FONT_FAMILY}`
  const titleText = fitText(ctx, title?.trim() ? `${title.trim()} dump` : 'travel dump', CANVAS_WIDTH - PADDING_X * 2)
  const titleWidth = ctx.measureText(titleText).width
  const titleGradient = ctx.createLinearGradient(
    (CANVAS_WIDTH - titleWidth) / 2, 0, (CANVAS_WIDTH + titleWidth) / 2, 0,
  )
  ;['#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#a78bfa'].forEach((color, index, list) => {
    titleGradient.addColorStop(index / (list.length - 1), color)
  })
  ctx.fillStyle = titleGradient
  ctx.fillText(titleText, CANVAS_WIDTH / 2, 130)

  if (periodLabel) {
    ctx.fillStyle = '#57534e'
    ctx.font = `32px ${FONT_FAMILY}`
    ctx.fillText(periodLabel, CANVAS_WIDTH / 2, 185)
  }

  // 폴라로이드 그리기
  validPhotos.forEach((photo, index) => {
    const row = Math.floor(index / columns)
    const col = index % columns
    // 마지막 줄이 덜 찼으면 가운데 정렬
    const itemsInRow = row === rows - 1 ? validPhotos.length - row * columns : columns
    const rowWidth = itemsInRow * cardWidth + (itemsInRow - 1) * GAP_X
    const rowStartX = (CANVAS_WIDTH - rowWidth) / 2
    const x = rowStartX + col * (cardWidth + GAP_X)
    const y = HEADER_HEIGHT + row * (cardHeight + GAP_Y)
    const rotation = (ROTATIONS[index % ROTATIONS.length] * Math.PI) / 180

    ctx.save()
    ctx.translate(x + cardWidth / 2, y + cardHeight / 2)
    ctx.rotate(rotation)
    ctx.translate(-cardWidth / 2, -cardHeight / 2)

    // 카드 + 그림자
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.16)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 10
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, cardWidth, cardHeight)
    ctx.restore()

    // 사진
    const bitmap = bitmaps[index]
    if (bitmap) {
      drawCoverImage(ctx, bitmap, POLAROID_FRAME, POLAROID_FRAME, imageSize)
    } else {
      ctx.fillStyle = '#e7e5e4'
      ctx.fillRect(POLAROID_FRAME, POLAROID_FRAME, imageSize, imageSize)
    }

    // 마스킹 테이프
    ctx.save()
    ctx.translate(cardWidth / 2, 0)
    ctx.rotate((-2 * Math.PI) / 180)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.strokeStyle = 'rgba(214, 211, 209, 0.9)'
    ctx.lineWidth = 2
    ctx.fillRect(-40, -12, 80, 24)
    ctx.strokeRect(-40, -12, 80, 24)
    ctx.restore()

    // 한줄 캡션
    if (photo.caption) {
      const captionFontSize = columns === 3 ? 26 : 32
      ctx.fillStyle = '#44403c'
      ctx.font = `${captionFontSize}px ${FONT_FAMILY}`
      ctx.textAlign = 'center'
      ctx.fillText(
        fitText(ctx, photo.caption, cardWidth - POLAROID_FRAME * 2),
        cardWidth / 2,
        POLAROID_FRAME + imageSize + CAPTION_AREA / 2 + captionFontSize / 3,
      )
    }

    ctx.restore()
  })

  // 하단 브랜드 문구
  ctx.textAlign = 'center'
  ctx.fillStyle = '#a8a29e'
  ctx.font = `28px ${FONT_FAMILY}`
  ctx.fillText(BRAND_LABEL, CANVAS_WIDTH / 2, canvasHeight - 50)

  bitmaps.forEach((bitmap) => bitmap?.close?.())

  return new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('앨범 이미지 변환에 실패했습니다.'))
    }, 'image/png')
  })
}

/**
 * 파일명에 쓸 수 없는 문자 제거
 * @param {string} title
 */
export function buildTravelAlbumFileName(title) {
  const safeTitle = (title || 'travel-album').trim().replace(/[\\/:*?"<>|\s]+/g, '-') || 'travel-album'
  return `posily-${safeTitle}.png`
}

/**
 * 앨범 이미지 저장 (다운로드)
 * @param {Blob} blob
 * @param {string} title
 */
export function downloadTravelAlbumImage(blob, title) {
  downloadImageBlob(blob, buildTravelAlbumFileName(title))
}

/**
 * 기기 공유 시트로 앨범 이미지 공유 (모바일 브라우저 등)
 * @param {Blob} blob
 * @param {string} title
 * @returns {Promise<boolean>} 공유 시트를 띄웠으면 true, 미지원이면 false
 */
export async function shareTravelAlbumImage(blob, title) {
  const file = new File([blob], buildTravelAlbumFileName(title), { type: 'image/png' })
  if (!navigator.canShare?.({ files: [file] })) return false
  await navigator.share({ files: [file], title: title || '여행 앨범' })
  return true
}
