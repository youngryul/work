/**
 * 네이버 금융 자동완성 응답에서 종목 배열 추출
 * @param {unknown} data
 * @returns {Array<Record<string, unknown>>}
 */
function extractNaverSearchItems(data) {
  if (!data || !Array.isArray(data.items) || data.items.length === 0) {
    return []
  }

  const first = data.items[0]

  // 신형: items가 객체 배열 [{ code, name, ... }]
  if (first && typeof first === 'object' && !Array.isArray(first) && first.code) {
    return data.items
  }

  // 구형: items[0]이 객체 배열
  if (Array.isArray(first)) {
    return first
  }

  return []
}

/**
 * @param {Record<string, unknown>} item
 * @returns {string}
 */
function toKoreanStockSymbol(item) {
  const code = String(item.code || '')
  const suffix = item.typeCode === 'KOSDAQ' ? '.KQ' : '.KS'
  const reuters = String(item.reutersCode || '')

  if (/^\d{6}\.(KS|KQ)$/i.test(reuters)) return reuters
  if (/^\d{6}$/.test(reuters)) return `${reuters}${suffix}`
  return `${code}${suffix}`
}

/**
 * 네이버 금융 자동완성 응답 정규화
 * @param {unknown} data
 * @returns {Array<{ symbol: string, description: string, type: string, displaySymbol: string, market: string }>}
 */
export function normalizeNaverSearchResponse(data) {
  const items = extractNaverSearchItems(data)

  return items
    .filter((item) => item?.code && item?.name)
    .slice(0, 20)
    .map((item) => ({
      symbol: toKoreanStockSymbol(item),
      description: String(item.name),
      type: String(item.typeName || item.typeCode || '국내주식'),
      displaySymbol: String(item.code),
      market: 'KR',
    }))
}

/**
 * 네이버 모바일 시세 응답 정규화
 * @param {string} symbol
 * @param {unknown} data
 */
export function normalizeNaverQuoteResponse(symbol, data) {
  const closePrice = Number(String(data?.closePrice || '').replace(/,/g, ''))
  const changeRaw = String(data?.compareToPreviousClosePrice || '').replace(/,/g, '')
  const change = Number(changeRaw)
  const changePercent = Number(String(data?.fluctuationsRatio || '').replace(/,/g, ''))
  const previousClose = closePrice - change

  const changeDirection = data?.compareToPreviousPrice?.code
  const signedChange = Number.isFinite(change)
    ? changeDirection === '5' || changeDirection === '4'
      ? -Math.abs(change)
      : change
    : 0

  return {
    symbol,
    currentPrice: closePrice,
    change: Number.isFinite(signedChange) ? signedChange : 0,
    changePercent: Number.isFinite(changePercent) ? changePercent : 0,
    high: Number(String(data?.highPrice || '').replace(/,/g, '')) || closePrice,
    low: Number(String(data?.lowPrice || '').replace(/,/g, '')) || closePrice,
    open: Number(String(data?.openPrice || '').replace(/,/g, '')) || closePrice,
    previousClose: Number.isFinite(previousClose) ? previousClose : closePrice,
    updatedAt: Date.now(),
    source: 'rest',
  }
}

/**
 * 국내 종목 코드 추출 (005930.KS → 005930)
 * @param {string} symbol
 * @returns {string | null}
 */
export function extractKoreanStockCode(symbol) {
  if (!symbol) return null
  if (/^\d{6}$/.test(symbol)) return symbol
  const match = symbol.match(/^(\d{6})\.(KS|KQ)$/i)
  return match ? match[1] : null
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function containsHangul(text) {
  return /[가-힣]/.test(text)
}
