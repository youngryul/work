import {
  POSILI_FOURCUT_FRAME_URL,
  POSILI_FOURCUT_FRAME_SIZE,
  POSILI_FOURCUT_SLOTS,
  POSILI_FOURCUT_OUTPUT_SCALE,
} from '../constants/posiliFourCutFrame.js'

/**
 * 이미지 URL 배열(1~4)을 포실이네컷 프레임에 채워 PNG Blob으로 합성
 * @param {string[]} imageUrls
 * @param {{ dateLabel?: string }} [options]
 * @returns {Promise<Blob>}
 */
export async function composeFourCutStrip(imageUrls, options = {}) {
  const urls = (imageUrls || []).filter(Boolean).slice(0, 4)
  if (urls.length === 0) {
    throw new Error('합성할 이미지가 없습니다.')
  }

  const scale = POSILI_FOURCUT_OUTPUT_SCALE
  const baseW = POSILI_FOURCUT_FRAME_SIZE.width
  const baseH = POSILI_FOURCUT_FRAME_SIZE.height
  const canvasW = Math.round(baseW * scale)
  const canvasH = Math.round(baseH * scale)

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas를 사용할 수 없습니다.')

  const [frameImg, ...sceneImgs] = await Promise.all([
    loadImage(POSILI_FOURCUT_FRAME_URL),
    ...urls.map((url) => loadImage(url)),
  ])

  // 1) 슬롯에 사진 채우기 (캐릭터·장식 아래로)
  POSILI_FOURCUT_SLOTS.forEach((slot, index) => {
    const img = sceneImgs[index]
    if (!img) return
    const x = slot.x * scale
    const y = slot.y * scale
    const w = slot.w * scale
    const h = slot.h * scale
    const radius = (slot.radius || 12) * scale

    ctx.save()
    roundRectPath(ctx, x, y, w, h, radius)
    ctx.clip()
    drawCover(ctx, img, x, y, w, h)
    ctx.restore()
  })

  // 2) 흰 슬롯만 뚫은 프레임 오버레이 (캐릭터·장식이 사진 위에)
  const overlay = makeFrameOverlay(frameImg, canvasW, canvasH, scale)
  ctx.drawImage(overlay, 0, 0)

  void options

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('4컷 이미지 생성에 실패했습니다.'))
        else resolve(blob)
      },
      'image/png',
      0.95,
    )
  })
}

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${url}`))
    img.src = url
  })
}

/**
 * object-fit: cover — 슬롯을 꽉 채움
 */
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  const dx = x + (w - dw) / 2
  const dy = y + (h - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * 슬롯 안 거의 흰 픽셀을 투명 처리한 프레임 캔버스
 * @param {HTMLImageElement} frameImg
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {number} scale
 * @returns {HTMLCanvasElement}
 */
function makeFrameOverlay(frameImg, canvasW, canvasH, scale) {
  const c = document.createElement('canvas')
  c.width = canvasW
  c.height = canvasH
  const ctx = c.getContext('2d')
  if (!ctx) return c

  ctx.drawImage(frameImg, 0, 0, canvasW, canvasH)
  const imageData = ctx.getImageData(0, 0, canvasW, canvasH)
  const d = imageData.data

  for (const slot of POSILI_FOURCUT_SLOTS) {
    const x0 = Math.floor(slot.x * scale)
    const y0 = Math.floor(slot.y * scale)
    const x1 = Math.ceil((slot.x + slot.w) * scale)
    const y1 = Math.ceil((slot.y + slot.h) * scale)

    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * canvasW + x) * 4
        if (d[i] > 240 && d[i + 1] > 240 && d[i + 2] > 240) {
          d[i + 3] = 0
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
  return c
}
