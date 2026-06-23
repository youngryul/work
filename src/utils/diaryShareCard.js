import {
  DIARY_SHARE_CARD_WIDTH,
  DIARY_SHARE_CARD_HEIGHT,
  DIARY_SHARE_CARD_BRAND_LABEL,
} from '../constants/diaryShareCard.js'
import { formatDiaryDateLabel } from './formatDiaryDateLabel.js'
import { loadImageBitmap, downloadImageBlob } from './imageBitmap.js'
import { buildDiaryShareLink } from './diaryShareLink.js'

/**
 * 웹 공유용 일기 사진 카드 Blob 생성
 * @param {string} imageUrl
 * @param {{ dateString?: string, emotionLabel?: string }} [options]
 * @returns {Promise<Blob>}
 */
export async function createDiaryShareCardBlob(imageUrl, options = {}) {
  const bitmap = await loadImageBitmap(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = DIARY_SHARE_CARD_WIDTH
  canvas.height = DIARY_SHARE_CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    throw new Error('카드 이미지를 만들 수 없습니다.')
  }

  const cardPadding = 56
  const cardX = 48
  const cardY = 48
  const cardW = DIARY_SHARE_CARD_WIDTH - 96
  const cardH = DIARY_SHARE_CARD_HEIGHT - 96
  const radius = 40

  const outerGradient = ctx.createLinearGradient(0, 0, DIARY_SHARE_CARD_WIDTH, DIARY_SHARE_CARD_HEIGHT)
  outerGradient.addColorStop(0, '#fce7f3')
  outerGradient.addColorStop(0.5, '#fef3c7')
  outerGradient.addColorStop(1, '#dbeafe')
  ctx.fillStyle = outerGradient
  ctx.fillRect(0, 0, DIARY_SHARE_CARD_WIDTH, DIARY_SHARE_CARD_HEIGHT)

  ctx.save()
  ctx.shadowColor = 'rgba(15, 23, 42, 0.18)'
  ctx.shadowBlur = 32
  ctx.shadowOffsetY = 12
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardW, cardH, radius)
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardW, cardH, radius)
  ctx.stroke()

  const dateLabel = options.dateString ? formatDiaryDateLabel(options.dateString) : ''
  const emotionLabel = options.emotionLabel || ''
  const shareLink = options.dateString ? buildDiaryShareLink(options.dateString) : ''

  ctx.textAlign = 'center'
  ctx.fillStyle = '#059669'
  ctx.font = 'bold 42px "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillText(DIARY_SHARE_CARD_BRAND_LABEL, DIARY_SHARE_CARD_WIDTH / 2, cardY + 72)

  ctx.fillStyle = '#1f2937'
  ctx.font = 'bold 48px "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  if (dateLabel) {
    ctx.fillText(dateLabel, DIARY_SHARE_CARD_WIDTH / 2, cardY + 132)
  }

  if (emotionLabel) {
    ctx.fillStyle = '#047857'
    ctx.font = '34px "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
    ctx.fillText(`오늘의 감정 · ${emotionLabel}`, DIARY_SHARE_CARD_WIDTH / 2, cardY + 188)
  }

  const imageTop = emotionLabel ? cardY + 220 : cardY + 170
  const imageBottomReserve = 150
  const imageHorizontalPadding = cardX + 40
  const maxImageWidth = cardW - 80
  const maxImageHeight = cardY + cardH - imageTop - imageBottomReserve
  const scale = Math.min(maxImageWidth / bitmap.width, maxImageHeight / bitmap.height)
  const drawWidth = bitmap.width * scale
  const drawHeight = bitmap.height * scale
  const drawX = (DIARY_SHARE_CARD_WIDTH - drawWidth) / 2
  const drawY = imageTop + (maxImageHeight - drawHeight) / 2
  const imageRadius = 24

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(drawX, drawY, drawWidth, drawHeight, imageRadius)
  ctx.clip()
  ctx.drawImage(bitmap, drawX, drawY, drawWidth, drawHeight)
  ctx.restore()

  ctx.strokeStyle = 'rgba(209, 213, 219, 0.9)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.roundRect(drawX, drawY, drawWidth, drawHeight, imageRadius)
  ctx.stroke()

  if (shareLink) {
    ctx.fillStyle = '#6b7280'
    ctx.font = '28px "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
    const displayLink = shareLink.replace(/^https?:\/\//, '')
    ctx.fillText(displayLink, DIARY_SHARE_CARD_WIDTH / 2, cardY + cardH - 56)
  }

  bitmap.close?.()

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('카드 이미지 변환에 실패했습니다.'))
    }, 'image/png', 0.92)
  })

  return blob
}

/**
 * 일기 카드 이미지 저장
 * @param {string} imageUrl
 * @param {{ dateString?: string, emotionLabel?: string }} [options]
 */
export async function downloadDiaryShareCard(imageUrl, options = {}) {
  const blob = await createDiaryShareCardBlob(imageUrl, options)
  const safeDate = options.dateString || 'diary'
  downloadImageBlob(blob, `posily-diary-card-${safeDate}.png`)
}
