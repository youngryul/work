import {
  FINNHUB_API_BASE_URL,
  FINNHUB_API_KEY_ENV,
  STOCK_API_KEY_MISSING_MESSAGE,
} from '../constants/stockMarket.js'
import {
  fetchKoreanStockQuote,
  isKoreanStockSymbol,
  searchKoreanStockSymbols,
  shouldUseKoreanStockSearch,
} from './koreanStockService.js'

/**
 * @typedef {Object} StockSearchResult
 * @property {string} symbol
 * @property {string} description
 * @property {string} type
 * @property {string} displaySymbol
 */

/**
 * @typedef {Object} StockQuote
 * @property {string} symbol
 * @property {number} currentPrice
 * @property {number} change
 * @property {number} changePercent
 * @property {number} high
 * @property {number} low
 * @property {number} open
 * @property {number} previousClose
 * @property {number} updatedAt
 * @property {'rest' | 'websocket'} source
 */

export class StockApiKeyMissingError extends Error {
  constructor() {
    super(STOCK_API_KEY_MISSING_MESSAGE)
    this.name = 'StockApiKeyMissingError'
  }
}

/**
 * @returns {string}
 */
export function getFinnhubApiKey() {
  return import.meta.env[FINNHUB_API_KEY_ENV] || ''
}

/**
 * @returns {boolean}
 */
export function isStockApiConfigured() {
  return Boolean(getFinnhubApiKey())
}

/**
 * @param {string} path
 * @returns {Promise<unknown>}
 */
async function finnhubFetch(path) {
  const token = getFinnhubApiKey()
  if (!token) throw new StockApiKeyMissingError()

  const separator = path.includes('?') ? '&' : '?'
  const response = await fetch(`${FINNHUB_API_BASE_URL}${path}${separator}token=${token}`)

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('API 호출 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.')
    }
    throw new Error('시세 정보를 불러오지 못했습니다.')
  }

  return response.json()
}

/**
 * 종목 검색 (한글 → 국내 API, 그 외 → Finnhub)
 * @param {string} query
 * @returns {Promise<StockSearchResult[]>}
 */
export async function searchStockSymbols(query) {
  const trimmed = query.trim()
  if (!trimmed) return []

  if (shouldUseKoreanStockSearch(trimmed)) {
    try {
      const koreanResults = await searchKoreanStockSymbols(trimmed)
      if (koreanResults.length > 0) return koreanResults
    } catch (error) {
      console.error('국내 종목 검색 오류:', error)
      if (containsHangulOnlyQuery(trimmed)) {
        throw error
      }
    }
  }

  if (!isStockApiConfigured()) {
    if (shouldUseKoreanStockSearch(trimmed)) {
      return []
    }
    throw new StockApiKeyMissingError()
  }

  const data = await finnhubFetch(`/search?q=${encodeURIComponent(trimmed)}`)
  const results = Array.isArray(data?.result) ? data.result : []

  return results
    .filter((item) => item?.symbol && item?.description)
    .slice(0, 20)
    .map((item) => ({
      symbol: item.symbol,
      description: item.description,
      type: item.type || '',
      displaySymbol: item.displaySymbol || item.symbol,
    }))
}

/**
 * @param {string} text
 */
function containsHangulOnlyQuery(text) {
  return /[가-힣]/.test(text) || /^\d{6}$/.test(text.trim())
}

/**
 * @param {string} symbol
 * @param {'rest' | 'websocket'} [source]
 * @returns {Promise<StockQuote>}
 */
export async function fetchStockQuote(symbol, source = 'rest') {
  if (isKoreanStockSymbol(symbol)) {
    return fetchKoreanStockQuote(symbol)
  }

  const data = await finnhubFetch(`/quote?symbol=${encodeURIComponent(symbol)}`)

  return {
    symbol,
    currentPrice: data.c ?? 0,
    change: data.d ?? 0,
    changePercent: data.dp ?? 0,
    high: data.h ?? 0,
    low: data.l ?? 0,
    open: data.o ?? 0,
    previousClose: data.pc ?? 0,
    updatedAt: (data.t ?? 0) * 1000,
    source,
  }
}

/**
 * @param {string[]} symbols
 * @returns {Promise<Record<string, StockQuote>>}
 */
export async function fetchStockQuotes(symbols) {
  const uniqueSymbols = [...new Set(symbols.filter(Boolean))]
  if (uniqueSymbols.length === 0) return {}

  const entries = await Promise.all(
    uniqueSymbols.map(async (symbol) => {
      try {
        if (isKoreanStockSymbol(symbol)) {
          const quote = await fetchKoreanStockQuote(symbol)
          return [symbol, quote]
        }
        if (!isStockApiConfigured()) {
          return [symbol, null]
        }
        const quote = await fetchStockQuote(symbol)
        return [symbol, quote]
      } catch (error) {
        console.error(`시세 조회 실패 (${symbol}):`, error)
        return [symbol, null]
      }
    }),
  )

  /** @type {Record<string, StockQuote>} */
  const quotes = {}
  entries.forEach(([symbol, quote]) => {
    if (quote) quotes[symbol] = quote
  })
  return quotes
}

/**
 * @param {number} value
 * @param {string} [currencyHint]
 * @returns {string}
 */
export function formatStockPrice(value, currencyHint = '') {
  if (!Number.isFinite(value) || value === 0) return '-'

  const isKrwLike = currencyHint.includes('KRX') || /\.KS$|\.KQ$/i.test(currencyHint)
  const formatter = new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: isKrwLike ? 0 : 2,
    maximumFractionDigits: isKrwLike ? 0 : 2,
  })
  return formatter.format(value)
}

/**
 * @param {number} value
 * @returns {string}
 */
export function formatStockChangePercent(value) {
  if (!Number.isFinite(value)) return '-'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}
