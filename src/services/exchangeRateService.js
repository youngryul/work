import { EXCHANGE_RATE_ITEMS } from '../constants/exchangeRates.js'

const NAVER_EXCHANGE_API = 'https://api.stock.naver.com/marketindex/exchange'

/**
 * @typedef {Object} ExchangeRateQuote
 * @property {string} code
 * @property {string} name
 * @property {number} price
 * @property {number} change
 * @property {number} changePercent
 * @property {string | null} updatedAt
 * @property {string} marketStatus
 */

/**
 * @returns {Promise<ExchangeRateQuote[]>}
 */
export async function fetchExchangeRates() {
  const response = await fetch('/api/korean-exchange-rates')
  if (!response.ok) {
    throw new Error('환율 정보를 불러오지 못했습니다.')
  }

  const data = await response.json()
  return Array.isArray(data.rates) ? data.rates : []
}

/**
 * @param {ExchangeRateQuote[]} quotes
 * @returns {Record<string, ExchangeRateQuote>}
 */
export function mapExchangeQuotesByCode(quotes) {
  return quotes.reduce((acc, quote) => {
    acc[quote.code] = quote
    return acc
  }, /** @type {Record<string, ExchangeRateQuote>} */ ({}))
}

export { EXCHANGE_RATE_ITEMS }
