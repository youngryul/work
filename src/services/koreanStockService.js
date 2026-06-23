import {
  containsHangul,
  extractKoreanStockCode,
  normalizeNaverQuoteResponse,
  normalizeNaverSearchResponse,
} from '../utils/koreanStock.js'

const KOREAN_SEARCH_API = '/api/korean-stock-search'
const KOREAN_QUOTE_API = '/api/korean-stock-quote'

/**
 * 국내 주식 한글 검색
 * @param {string} query
 * @returns {Promise<import('./stockMarketService.js').StockSearchResult[]>}
 */
export async function searchKoreanStockSymbols(query) {
  const trimmed = query.trim()
  if (!trimmed) return []

  const response = await fetch(`${KOREAN_SEARCH_API}?q=${encodeURIComponent(trimmed)}`)
  if (!response.ok) {
    throw new Error('국내 종목 검색에 실패했습니다.')
  }

  const data = await response.json()
  return normalizeNaverSearchResponse(data.results ?? data)
}

/**
 * 국내 주식 시세 조회
 * @param {string} symbol
 * @returns {Promise<import('./stockMarketService.js').StockQuote>}
 */
export async function fetchKoreanStockQuote(symbol) {
  const code = extractKoreanStockCode(symbol)
  if (!code) {
    throw new Error('국내 종목 코드가 아닙니다.')
  }

  const response = await fetch(`${KOREAN_QUOTE_API}?code=${encodeURIComponent(code)}`)
  if (!response.ok) {
    throw new Error('국내 시세를 불러오지 못했습니다.')
  }

  const data = await response.json()
  return normalizeNaverQuoteResponse(symbol, data.quote ?? data)
}

/**
 * @param {string} symbol
 * @returns {boolean}
 */
export function isKoreanStockSymbol(symbol) {
  return Boolean(extractKoreanStockCode(symbol))
}

/**
 * 한글 검색어이거나 국내 종목 코드 형식이면 국내 API 우선
 * @param {string} query
 * @returns {boolean}
 */
export function shouldUseKoreanStockSearch(query) {
  const trimmed = query.trim()
  if (!trimmed) return false
  if (containsHangul(trimmed)) return true
  if (/^\d{6}$/.test(trimmed)) return true
  if (/^\d{6}\.(KS|KQ)$/i.test(trimmed)) return true
  return false
}
