/** Finnhub 시세 폴링 간격 (ms) — 무료 플랜 API 한도 고려 */
export const STOCK_QUOTE_POLL_INTERVAL_MS = 15_000

export const FINNHUB_API_BASE_URL = 'https://finnhub.io/api/v1'

export const FINNHUB_WS_URL = 'wss://ws.finnhub.io'

/** @see https://finnhub.io/register 무료 API 키 발급 */
export const FINNHUB_API_KEY_ENV = 'VITE_FINNHUB_API_KEY'

export const STOCK_API_KEY_MISSING_MESSAGE =
  '주식 시세 API 키가 설정되지 않았습니다. VITE_FINNHUB_API_KEY 환경 변수를 추가해 주세요.'

export const STOCK_SEARCH_DEBOUNCE_MS = 400

export const STOCK_SEARCH_MIN_LENGTH = 1
