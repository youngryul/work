/**
 * 통화 → KRW 환율 프록시 (브라우저 CORS 회피)
 * Frankfurter 우선, 실패 시 open.er-api.com 폴백
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

/**
 * @param {string} currencyCode
 * @returns {Promise<number|null>}
 */
async function fetchFromFrankfurter(currencyCode) {
  const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(currencyCode)}&to=KRW`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return null
  const data = await response.json()
  const rate = data?.rates?.KRW
  return typeof rate === 'number' ? rate : null
}

/**
 * @param {string} currencyCode
 * @returns {Promise<number|null>}
 */
async function fetchFromOpenErApi(currencyCode) {
  const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(currencyCode)}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) return null
  const data = await response.json()
  if (data?.result !== 'success') return null
  const rate = data?.rates?.KRW
  return typeof rate === 'number' ? rate : null
}

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

  const url = new URL(req.url || '/', 'http://localhost')
  const from = (url.searchParams.get('from') || '').trim().toUpperCase()

  if (!from || from.length !== 3) {
    sendJson(res, 400, { error: 'from 통화 코드가 필요합니다. (예: VND)' })
    return
  }

  if (from === 'KRW') {
    sendJson(res, 200, { from, to: 'KRW', rate: 1, source: 'identity' })
    return
  }

  try {
    let rate = await fetchFromFrankfurter(from)
    let source = 'frankfurter'

    if (rate == null) {
      rate = await fetchFromOpenErApi(from)
      source = 'open-er-api'
    }

    if (rate == null) {
      sendJson(res, 404, { error: `${from} 환율을 찾을 수 없습니다.` })
      return
    }

    sendJson(res, 200, { from, to: 'KRW', rate, source })
  } catch (error) {
    console.error('currency-to-krw error:', error)
    sendJson(res, 500, { error: '환율 조회 중 오류가 발생했습니다.' })
  }
}
