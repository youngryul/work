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

/** 주소 추출용 패턴: URL에 쓰는 ASCII 문자까지만 (예: 'https://a.com에서' → 'https://a.com') */
const LINK_EXTRACT_PATTERN = /(?:https?:\/\/|www\.)[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/gi

/** URL 끝에 붙어 있으면 주소가 아닌 것으로 보는 문장 부호 */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>'"’”」』。、]+$/

/**
 * 텍스트를 일반 글자와 사이트 주소 구간으로 나눈다 (원문 글자는 그대로 보존)
 * 에디터 위에 링크를 겹쳐 그릴 때 글자 위치가 어긋나지 않도록 모든 문자를 빠짐없이 돌려준다.
 * @param {string} text
 * @returns {Array<{ type: 'text' | 'link', content: string, url?: string }>}
 */
export function splitTextLinks(text) {
  if (!text || typeof text !== 'string') return []

  const segments = []
  let lastIndex = 0
  for (const match of text.matchAll(LINK_EXTRACT_PATTERN)) {
    const label = match[0].replace(TRAILING_PUNCTUATION, '')
    if (!label || label.toLowerCase() === 'www.') continue
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    const url = label.toLowerCase().startsWith('www.') ? `https://${label}` : label
    segments.push({ type: 'link', content: label, url })
    lastIndex = match.index + label.length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) })
  }
  return segments
}
