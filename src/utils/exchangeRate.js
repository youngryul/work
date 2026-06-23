/**
 * @param {string | number | null | undefined} value
 * @returns {number}
 */
export function parseExchangeNumber(value) {
  if (value == null) return NaN
  return Number(String(value).replace(/,/g, ''))
}

/**
 * @param {unknown} data
 * @returns {import('../services/exchangeRateService.js').ExchangeRateQuote | null}
 */
export function normalizeNaverExchangeResponse(data) {
  const info = data?.exchangeInfo
  if (!info?.reutersCode) return null

  const change = parseExchangeNumber(info.fluctuations)
  const changePercent = parseExchangeNumber(info.fluctuationsRatio)
  const direction = info.fluctuationsType?.code
  const signedChange =
    direction === '5' || direction === '4'
      ? -Math.abs(change)
      : change

  return {
    code: info.reutersCode,
    name: info.name || info.exchangeCode || info.reutersCode,
    price: parseExchangeNumber(info.closePrice),
    change: Number.isFinite(signedChange) ? signedChange : 0,
    changePercent: Number.isFinite(changePercent) ? changePercent : 0,
    updatedAt: info.localTradedAt || null,
    marketStatus: info.marketStatus || '',
  }
}

/**
 * @param {number} value
 * @returns {string}
 */
export function formatExchangePrice(value) {
  if (!Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * @param {number} value
 * @returns {string}
 */
export function formatExchangeChangePercent(value) {
  if (!Number.isFinite(value)) return '-'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}
