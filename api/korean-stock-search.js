const NAVER_SEARCH_URL = 'https://ac.stock.naver.com/ac'
const NAVER_QUOTE_URL = 'https://m.stock.naver.com/api/stock'

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Record<string, string>}
 */
function getQuery(req) {
  const url = new URL(req.url || '/', 'http://localhost')
  return Object.fromEntries(url.searchParams.entries())
}

/**
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

/**
 * Vercel Serverless — 국내 주식 한글 검색 (네이버 금융)
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const query = getQuery(req).q?.trim()
  if (!query) {
    sendJson(res, 200, { results: [] })
    return
  }

  try {
    const params = new URLSearchParams({
      q: query,
      target: 'stock',
      lang: 'ko',
      caller: 'pcweb',
    })

    const response = await fetch(`${NAVER_SEARCH_URL}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      sendJson(res, 502, { error: '국내 종목 검색에 실패했습니다.' })
      return
    }

    const data = await response.json()
    sendJson(res, 200, { results: data })
  } catch (error) {
    console.error('korean-stock-search error:', error)
    sendJson(res, 500, { error: '국내 종목 검색 중 오류가 발생했습니다.' })
  }
}
