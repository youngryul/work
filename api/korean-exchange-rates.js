import { EXCHANGE_RATE_ITEMS } from '../src/constants/exchangeRates.js'
import { normalizeNaverExchangeResponse } from '../src/utils/exchangeRate.js'

const NAVER_EXCHANGE_API = 'https://api.stock.naver.com/marketindex/exchange'

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
 * Vercel Serverless — 주요 환율 (네이버 금융)
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

  const query = getQuery(req)
  const codes = query.codes
    ? query.codes.split(',').map((code) => code.trim()).filter(Boolean)
    : EXCHANGE_RATE_ITEMS.map((item) => item.code)

  try {
    const results = await Promise.all(
      codes.map(async (code) => {
        const response = await fetch(`${NAVER_EXCHANGE_API}/${code}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json',
          },
        })

        if (!response.ok) {
          return null
        }

        const data = await response.json()
        return normalizeNaverExchangeResponse(data)
      }),
    )

    sendJson(res, 200, {
      rates: results.filter(Boolean),
    })
  } catch (error) {
    console.error('korean-exchange-rates error:', error)
    sendJson(res, 500, { error: '환율 조회 중 오류가 발생했습니다.' })
  }
}
