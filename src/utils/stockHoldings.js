import { formatStockChangePercent, formatStockPrice } from '../services/stockMarketService.js'

/**
 * 보유 정보가 등록된 종목인지 확인
 * @param {{ holdingsQuantity?: number | null, averagePrice?: number | null }} item
 * @returns {boolean}
 */
export function hasStockHoldings(item) {
  return (
    Number.isFinite(item.holdingsQuantity)
    && item.holdingsQuantity > 0
    && Number.isFinite(item.averagePrice)
    && item.averagePrice > 0
  )
}

/**
 * @param {number | null | undefined} currentPrice
 * @param {number | null | undefined} averagePrice
 * @param {number | null | undefined} quantity
 * @returns {{ profitLoss: number, profitLossPercent: number } | null}
 */
export function calculateStockProfitLoss(currentPrice, averagePrice, quantity) {
  if (
    !Number.isFinite(currentPrice)
    || !Number.isFinite(averagePrice)
    || !Number.isFinite(quantity)
    || averagePrice <= 0
    || quantity <= 0
  ) {
    return null
  }

  const profitLoss = (currentPrice - averagePrice) * quantity
  const profitLossPercent = ((currentPrice - averagePrice) / averagePrice) * 100

  return { profitLoss, profitLossPercent }
}

/**
 * 평가손익 금액 포맷 (+/- 포함)
 * @param {number} value
 * @param {string} symbol
 * @returns {string}
 */
export function formatStockProfitLoss(value, symbol = '') {
  if (!Number.isFinite(value)) return '-'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatStockPrice(value, symbol)}`
}

/**
 * 평가손익률 포맷
 * @param {number} value
 * @returns {string}
 */
export function formatStockProfitLossPercent(value) {
  return formatStockChangePercent(value)
}

/**
 * @param {string | number | null | undefined} value
 * @returns {number | null}
 */
export function parseHoldingsNumber(value) {
  if (value === '' || value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
