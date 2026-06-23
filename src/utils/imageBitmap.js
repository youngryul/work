/**
 * URL에서 이미지 비트맵 로드
 * @param {string} imageUrl
 * @returns {Promise<ImageBitmap>}
 */
export async function loadImageBitmap(imageUrl) {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error('이미지를 불러올 수 없습니다.')
  }
  const blob = await response.blob()
  return createImageBitmap(blob)
}

/**
 * @param {Blob} blob
 * @param {string} fileName
 */
export function downloadImageBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
