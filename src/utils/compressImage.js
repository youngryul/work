import {
  TRAVEL_ALBUM_JPEG_QUALITY,
  TRAVEL_ALBUM_MAX_EDGE_PX,
} from '../constants/travelConstants.js'

/**
 * File/Blob을 이미지로 그린 뒤 JPEG로 압축한다.
 * 이미 충분히 작으면 원본을 그대로 반환한다.
 * @param {File} file
 * @param {{ maxEdge?: number, quality?: number }} [options]
 * @returns {Promise<File>}
 */
export async function compressImageFile(file, options = {}) {
  if (!file || !file.type?.startsWith('image/')) return file

  const maxEdge = options.maxEdge ?? TRAVEL_ALBUM_MAX_EDGE_PX
  const quality = options.quality ?? TRAVEL_ALBUM_JPEG_QUALITY
  const skipIfSmallerThan = 400 * 1024

  try {
    const bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)
    const scale = longest > maxEdge ? maxEdge / longest : 1

    if (scale === 1 && file.size <= skipIfSmallerThan && file.type === 'image/jpeg') {
      bitmap.close?.()
      return file
    }

    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) {
      bitmap.close?.()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob = await new Promise((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/jpeg', quality)
    })

    if (!blob || blob.size >= file.size) return file

    const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '')
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
  } catch (error) {
    console.warn('이미지 압축을 건너뜁니다.', error)
    return file
  }
}

/**
 * 이미 올라간 사진 URL을 받아 JPEG로 압축한다.
 * @param {string} imageUrl
 * @returns {Promise<{ original: File, compressed: File }>}
 */
export async function compressImageFromUrl(imageUrl) {
  const response = await fetch(imageUrl)
  if (!response.ok) throw new Error('사진을 불러오지 못했습니다.')
  const blob = await response.blob()
  const type = blob.type?.startsWith('image/') ? blob.type : 'image/jpeg'
  const original = new File([blob], 'album-photo.jpg', { type })
  const compressed = await compressImageFile(original)
  return { original, compressed }
}
