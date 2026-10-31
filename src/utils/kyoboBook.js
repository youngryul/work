/**
 * 교보문고 공개 검색 페이지 조회 및 결과 변환
 * 교보문고는 공식 Open API가 없어 검색 결과 HTML을 파싱한다. (robots.txt가 막는 /api/ 경로는 호출하지 않음)
 * 페이지 구조가 바뀌면 파싱 결과가 비게 되므로 이 파일을 먼저 확인한다.
 * CORS 미지원이므로 서버(Vercel 함수 / Vite dev 미들웨어)에서만 호출한다.
 */

const KYOBO_SEARCH_URL = 'https://search.kyobobook.co.kr/search'
const KYOBO_COVER_BASE = 'https://contents.kyobobook.co.kr/sih/fit-in/458x0/pdt'
const KYOBO_TIMEOUT_MS = 8000

/**
 * HTML 엔티티 디코딩 및 태그 제거
 * @param {string} html
 * @returns {string}
 */
function toText(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * "2024년 11월 13일" 형태의 출간일을 "2024-11-13"으로 변환
 * @param {string} text
 * @returns {string}
 */
function parsePublishedDate(text) {
  const match = text.match(/(\d{4})년\s*(\d{1,2})월(?:\s*(\d{1,2})일)?/)
  if (!match) return ''
  const [, year, month, day] = match
  return [year, month.padStart(2, '0'), ...(day ? [day.padStart(2, '0')] : [])].join('-')
}

/**
 * 검색 결과 항목 하나를 앱 공통 책 형식으로 변환
 * @param {string} html - <li class="prod_item"> 내부 HTML
 * @returns {Object|null} 종이책이 아니거나 필수 값이 없으면 null
 */
export function parseKyoboItem(html) {
  const productId = html.match(/product\.kyobobook\.co\.kr\/detail\/(S\d+)/)?.[1]
  const title = html.match(/<span id="cmdtName_[^"]*">([\s\S]*?)<\/span>/)?.[1]
  if (!productId || !title) return null

  const isbn = html.match(/data-bid="(\d+)"/)?.[1] || ''
  const authors = [...html.matchAll(/<a[^>]*class="author[^"]*"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((match) => toText(match[1]))
    .filter(Boolean)
  const publishBlock = html.match(/<div class="prod_publish">([\s\S]*?)<\/div>/)?.[1] || ''

  return {
    apiId: productId,
    title: toText(title),
    author: [...new Set(authors)].join(', '),
    publisher: toText(publishBlock.match(/<a[^>]*class="text"[^>]*>([\s\S]*?)<\/a>/)?.[1]),
    isbn,
    thumbnailUrl: isbn ? `${KYOBO_COVER_BASE}/${isbn}.jpg` : '',
    description: '',
    pageCount: 0,
    publishedDate: parsePublishedDate(toText(publishBlock.match(/<span class="date">([\s\S]*?)<\/span>/)?.[1])),
    apiSource: 'kyobo',
  }
}

/**
 * 교보문고 검색 결과 HTML 파싱
 * @param {string} html
 * @returns {Array<Object>}
 */
export function parseKyoboSearchHtml(html) {
  return html
    .split('<li class="prod_item">')
    .slice(1)
    .map(parseKyoboItem)
    .filter(Boolean)
}

/**
 * 교보문고 도서 검색
 * @param {string} query - 검색어
 * @returns {Promise<Array<Object>>}
 */
export async function searchKyoboBooks(query) {
  const params = new URLSearchParams({ keyword: query, gbCode: 'TOT', target: 'total' })

  const response = await fetch(`${KYOBO_SEARCH_URL}?${params.toString()}`, {
    headers: { Accept: 'text/html', 'Accept-Language': 'ko-KR,ko;q=0.9' },
    signal: AbortSignal.timeout(KYOBO_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`교보문고 응답 오류 (${response.status})`)
  }

  const html = await response.text()
  // 상품 목록이 있는데 하나도 파싱하지 못했다면 구조 변경을 로그로 남긴다
  const books = parseKyoboSearchHtml(html)
  if (books.length === 0 && html.includes('<li class="prod_item">')) {
    console.warn('교보문고 검색 결과 파싱 실패: 페이지 구조 변경 확인 필요')
  }
  return books
}
