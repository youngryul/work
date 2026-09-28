/**
 * 알라딘 Open API(ItemSearch) 호출 및 응답 변환
 * 알라딘 API는 CORS를 지원하지 않으므로 서버(Vercel 함수 / Vite dev 미들웨어)에서만 호출한다.
 */

const ALADIN_SEARCH_API = 'https://www.aladin.co.kr/ttb/api/ItemSearch.aspx'

/**
 * 알라딘 응답 문자열의 HTML 엔티티 디코딩
 * @param {string} text
 * @returns {string}
 */
function decodeEntities(text) {
  return String(text || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

/**
 * "홍길동 (지은이), 김철수 (옮긴이)" 형태의 저자 문자열에서 역할 표기 제거
 * @param {string} author
 * @returns {string}
 */
function cleanAuthor(author) {
  return decodeEntities(author)
    .split(',')
    .map((name) => name.replace(/\s*\([^)]*\)\s*$/, '').trim())
    .filter(Boolean)
    .join(', ')
}

/**
 * 알라딘 item을 앱 공통 책 형식으로 변환
 * @param {Object} item - 알라딘 ItemSearch item
 * @returns {Object}
 */
export function mapAladinItem(item) {
  return {
    apiId: item.itemId != null ? String(item.itemId) : (item.isbn13 || item.isbn || ''),
    title: decodeEntities(item.title),
    author: cleanAuthor(item.author),
    publisher: decodeEntities(item.publisher),
    isbn: item.isbn13 || item.isbn || '',
    thumbnailUrl: item.cover || '',
    description: decodeEntities(item.description),
    pageCount: item.subInfo?.itemPage || 0,
    publishedDate: item.pubDate || '',
    apiSource: 'aladin',
  }
}

/**
 * 알라딘 도서 검색
 * @param {string} query - 검색어
 * @param {string} ttbKey - 알라딘 TTB 키
 * @returns {Promise<Array<Object>>}
 */
export async function searchAladinBooks(query, ttbKey) {
  const params = new URLSearchParams({
    ttbkey: ttbKey,
    Query: query,
    QueryType: 'Keyword',
    SearchTarget: 'Book',
    MaxResults: '20',
    start: '1',
    Cover: 'Big',
    output: 'js',
    Version: '20131101',
  })

  const response = await fetch(`${ALADIN_SEARCH_API}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`알라딘 API 응답 오류 (${response.status})`)
  }

  const data = await response.json()
  if (data.errorCode) {
    throw new Error(`알라딘 API 오류: ${data.errorMessage || data.errorCode}`)
  }

  return (data.item || []).map(mapAladinItem)
}
