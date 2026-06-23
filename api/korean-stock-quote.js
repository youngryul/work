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
 * Vercel Serverless — 국내 주식 시세 (네이버 금융)
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

  const rawCode = getQuery(req).code?.trim()
  const code = rawCode?.replace(/\.(KS|KQ)$/i, '')

  if (!code || !/^\d{6}$/.test(code)) {
    sendJson(res, 400, { error: '유효한 6자리 종목 코드가 필요합니다.' })
    return
  }

  try {
    const response = await fetch(`${NAVER_QUOTE_URL}/${code}/basic`, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      sendJson(res, 502, { error: '국내 시세 조회에 실패했습니다.' })
      return
    }

    const data = await response.json()
    sendJson(res, 200, { quote: data })
  } catch (error) {
    console.error('korean-stock-quote error:', error)
    sendJson(res, 500, { error: '국내 시세 조회 중 오류가 발생했습니다.' })
  }
}
