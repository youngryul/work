import { searchKyoboBooks } from '../src/utils/kyoboBook.js'

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
 * Vercel Serverless — 책 검색 (교보문고 공개 검색 페이지)
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

  const url = new URL(req.url || '/', 'http://localhost')
  const q = (url.searchParams.get('q') || '').trim()
  if (!q) {
    sendJson(res, 200, { books: [] })
    return
  }

  try {
    const books = await searchKyoboBooks(q)
    sendJson(res, 200, { books })
  } catch (error) {
    console.error('book-search error:', error)
    sendJson(res, 502, { error: '책 검색 중 오류가 발생했습니다.' })
  }
}
