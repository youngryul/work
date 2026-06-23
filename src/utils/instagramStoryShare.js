import {
  INSTAGRAM_STORY_WIDTH,
  INSTAGRAM_STORY_HEIGHT,
  INSTAGRAM_STORY_BRAND_LABEL,
} from '../constants/instagramStory.js'
import { formatDiaryDateLabel } from './formatDiaryDateLabel.js'
import { loadImageBitmap, downloadImageBlob } from './imageBitmap.js'

/**
 * 스토리용 9:16 이미지 Blob 생성
 * @param {string} imageUrl
 * @param {{ dateString?: string, emotionLabel?: string }} [options]
 * @returns {Promise<Blob>}
 */
export async function createInstagramStoryImageBlob(imageUrl, options = {}) {
  const bitmap = await loadImageBitmap(imageUrl)
  const canvas = document.createElement('canvas')
  canvas.width = INSTAGRAM_STORY_WIDTH
  canvas.height = INSTAGRAM_STORY_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    throw new Error('이미지를 만들 수 없습니다.')
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, INSTAGRAM_STORY_HEIGHT)
  gradient.addColorStop(0, '#fdf2f8')
  gradient.addColorStop(0.45, '#fef5e7')
  gradient.addColorStop(1, '#dbeafe')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, INSTAGRAM_STORY_WIDTH, INSTAGRAM_STORY_HEIGHT)

  const dateLabel = options.dateString ? formatDiaryDateLabel(options.dateString) : ''
  const emotionLabel = options.emotionLabel || ''

  ctx.textAlign = 'center'
  ctx.fillStyle = '#1f2937'
  ctx.font = 'bold 52px "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  if (dateLabel) {
    ctx.fillText(dateLabel, INSTAGRAM_STORY_WIDTH / 2, 200)
  }

  if (emotionLabel) {
    ctx.fillStyle = '#059669'
    ctx.font = '40px "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
    ctx.fillText(`오늘의 감정 · ${emotionLabel}`, INSTAGRAM_STORY_WIDTH / 2, 270)
  }

  const topY = emotionLabel ? 320 : 280
  const bottomReserve = 200
  const horizontalPadding = 72
  const maxWidth = INSTAGRAM_STORY_WIDTH - horizontalPadding * 2
  const maxHeight = INSTAGRAM_STORY_HEIGHT - topY - bottomReserve
  const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height)
  const drawWidth = bitmap.width * scale
  const drawHeight = bitmap.height * scale
  const drawX = (INSTAGRAM_STORY_WIDTH - drawWidth) / 2
  const drawY = topY + (maxHeight - drawHeight) / 2
  const radius = 32

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(drawX, drawY, drawWidth, drawHeight, radius)
  ctx.clip()
  ctx.drawImage(bitmap, drawX, drawY, drawWidth, drawHeight)
  ctx.restore()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.roundRect(drawX, drawY, drawWidth, drawHeight, radius)
  ctx.stroke()

  ctx.fillStyle = '#6b7280'
  ctx.font = '36px "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.fillText(INSTAGRAM_STORY_BRAND_LABEL, INSTAGRAM_STORY_WIDTH / 2, INSTAGRAM_STORY_HEIGHT - 110)

  bitmap.close?.()

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('스토리 이미지 변환에 실패했습니다.'))
    }, 'image/png', 0.92)
  })

  return blob
}

/**
 * 일기 AI 이미지를 인스타 스토리용으로 공유 (모바일 전용)
 * @param {string} imageUrl
 * @param {{ dateString?: string, emotionLabel?: string }} [options]
 * @returns {Promise<'share' | 'download'>}
 */
export async function shareDiaryImageToInstagramStory(imageUrl, options = {}) {
  const blob = await createInstagramStoryImageBlob(imageUrl, options)
  const safeDate = options.dateString || 'diary'
  const fileName = `posily-diary-${safeDate}.png`
  const file = new File([blob], fileName, { type: 'image/png' })

  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: INSTAGRAM_STORY_BRAND_LABEL,
      })
      return 'share'
    }
  }

  downloadImageBlob(blob, fileName)
  return 'download'
}
