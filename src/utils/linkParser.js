/**
 * 텍스트 내의 URL을 감지하고 링크로 변환하는 유틸리티
 */

/**
 * URL 패턴을 감지하는 정규식
 * http://, https://, www.로 시작하는 URL을 감지
 */
const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi

/**
 * 텍스트에서 URL을 찾아 링크로 변환
 * @param {string} text - 변환할 텍스트
 * @returns {Array} 텍스트와 링크가 섞인 배열 [{ type: 'text' | 'link', content: string, url?: string }]
 */
export function parseLinks(text) {
  if (!text || typeof text !== 'string') {
    return [{ type: 'text', content: text || '' }]
  }

  const parts = []
  let lastIndex = 0
  let match

  // 정규식으로 URL 찾기
  while ((match = URL_PATTERN.exec(text)) !== null) {
    // URL 이전의 텍스트 추가
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      })
    }

    // URL 처리
    let url = match[0]
    // www.로 시작하는 경우 https:// 추가
    if (url.startsWith('www.')) {
      url = 'https://' + url
    }

    parts.push({
      type: 'link',
      content: match[0],
      url: url,
    })

    lastIndex = URL_PATTERN.lastIndex
  }

  // 마지막 텍스트 추가
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex),
    })
  }

  // URL이 없으면 원본 텍스트 반환
  if (parts.length === 0) {
    return [{ type: 'text', content: text }]
  }

  return parts
}

/**
 * 텍스트를 줄 단위로 분리하고 각 줄에서 링크를 파싱
 * @param {string} text - 변환할 텍스트
 * @returns {Array} 줄 단위로 파싱된 배열
 */
export function parseTextWithLinks(text) {
  if (!text || typeof text !== 'string') {
    return []
  }

  // 줄바꿈으로 분리
  const lines = text.split('\n')
  const result = []

  lines.forEach((line, lineIndex) => {
    const parts = parseLinks(line)
    result.push({
      lineIndex,
      parts,
    })
  })

  return result
}

