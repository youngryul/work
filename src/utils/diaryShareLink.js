/**
 * 일기 공유 링크 생성
 * @param {string} dateString - YYYY-MM-DD
 * @returns {string}
 */
export function buildDiaryShareLink(dateString) {
  const base = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '')
  const params = new URLSearchParams({ view: 'diary-calendar' })
  if (dateString) {
    params.set('date', dateString)
  }
  return `${base}/?${params.toString()}`
}

/**
 * 클립보드에 텍스트 복사
 * @param {string} text
 */
export async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('링크 복사에 실패했습니다.')
  }
}
