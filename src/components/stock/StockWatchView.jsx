import { useEffect, useState } from 'react'
import {
  STOCK_SEARCH_DEBOUNCE_MS,
  STOCK_SEARCH_MIN_LENGTH,
} from '../../constants/stockMarket.js'
import { useExchangeRates } from '../../hooks/useExchangeRates.js'
import { useStockLiveQuotes } from '../../hooks/useStockLiveQuotes.js'
import {
  formatExchangeChangePercent,
  formatExchangePrice,
} from '../../utils/exchangeRate.js'
import {
  formatStockChangePercent,
  formatStockPrice,
  searchStockSymbols,
  StockApiKeyMissingError,
} from '../../services/stockMarketService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import ViewPageTitle from '../ViewPageTitle.jsx'

/**
 * 시세 갱신 시각 포맷
 * @param {number | null} timestamp
 * @returns {string}
 */
function formatUpdatedAt(timestamp) {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * 주식 관심 종목 · 실시간 시세 화면
 */
export default function StockWatchView() {
  const {
    watchlist,
    quotes,
    isLoading,
    isRefreshing,
    lastUpdatedAt,
    isApiConfigured,
    isLiveConnected,
    error,
    addSymbol,
    removeSymbol,
    refreshQuotes,
  } = useStockLiveQuotes()

  const {
    items: exchangeItems,
    quotesByCode: exchangeQuotes,
    isLoading: isExchangeLoading,
    isRefreshing: isExchangeRefreshing,
    lastUpdatedAt: exchangeLastUpdatedAt,
    error: exchangeError,
    refreshRates,
  } = useExchangeRates()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)

  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (trimmed.length < STOCK_SEARCH_MIN_LENGTH) {
      setSearchResults([])
      setSearchError(null)
      return undefined
    }

    const timer = window.setTimeout(async () => {
      setIsSearching(true)
      setSearchError(null)
      try {
        const results = await searchStockSymbols(trimmed)
        setSearchResults(results)
      } catch (err) {
        console.error('종목 검색 오류:', err)
        setSearchResults([])
        setSearchError(
          err instanceof StockApiKeyMissingError
            ? '해외 종목 검색에는 Finnhub API 키가 필요합니다.'
            : err?.message || '종목 검색에 실패했습니다.',
        )
      } finally {
        setIsSearching(false)
      }
    }, STOCK_SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const handleAddSymbol = async (result) => {
    if (watchlist.some((item) => item.symbol === result.symbol)) {
      showToast('이미 관심 종목에 있습니다.', TOAST_TYPES.INFO)
      return
    }

    try {
      await addSymbol({
        symbol: result.symbol,
        displayName: result.description,
        exchange: result.type,
      })
      showToast(`"${result.description}"을(를) 추가했습니다.`, TOAST_TYPES.SUCCESS)
      setSearchQuery('')
      setSearchResults([])
    } catch (err) {
      showToast(err?.message || '종목 추가에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleRemoveSymbol = async (id, name) => {
    try {
      await removeSymbol(id)
      showToast(`"${name}"을(를) 삭제했습니다.`, TOAST_TYPES.SUCCESS)
    } catch (err) {
      showToast(err?.message || '종목 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <ViewPageTitle icon="📈" title="주식 확인">
        <p className="text-xl text-gray-600">
          종목을 검색해 관심 목록에 추가하고 시세 변동을 확인하세요.
        </p>
      </ViewPageTitle>

      {!isApiConfigured && (
        <div className="mb-6 rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900 font-sans">
          <p className="font-semibold mb-2">국내 종목은 API 키 없이 사용 가능</p>
          <p>한글로 국내 주식을 검색하고 시세를 확인할 수 있습니다.</p>
          <p className="mt-2 text-blue-800">
            해외 종목(AAPL 등)까지 보려면{' '}
            <a
              href="https://finnhub.io/register"
              target="_blank"
              rel="noreferrer"
              className="underline font-medium"
            >
              Finnhub
            </a>
            API 키를 `.env`의 <code className="bg-blue-100 px-1 rounded">VITE_FINNHUB_API_KEY</code>에 설정하세요.
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 mb-6">
        <label htmlFor="stock-search" className="block text-sm font-semibold text-gray-700 mb-2 font-sans">
          종목 검색
        </label>
        <input
          id="stock-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="삼성전자, 카카오, 005930 등 한글 검색"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-green-400 font-sans"
        />
        <p className="mt-2 text-xs text-gray-500 font-sans">
          국내 종목은 <strong>한글 종목명</strong> 또는 <strong>6자리 종목코드</strong>로 검색하세요. 해외 종목은 영문 티커(AAPL)를 사용합니다.
        </p>

        {isSearching && (
          <p className="mt-3 text-sm text-gray-500 font-sans">검색 중...</p>
        )}

        {searchError && (
          <p className="mt-3 text-sm text-red-600 font-sans">{searchError}</p>
        )}

        {searchResults.length > 0 && (
          <ul className="mt-4 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {searchResults.map((result) => (
              <li
                key={`${result.symbol}-${result.displaySymbol}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 font-sans truncate">
                    {result.description}
                  </p>
                  <p className="text-sm text-gray-500 font-sans">
                    {result.displaySymbol}
                    {result.type ? ` · ${result.type}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddSymbol(result)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 font-sans"
                >
                  추가
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 font-sans">관심 종목</h2>
            <p className="text-sm text-gray-500 font-sans mt-1">
              {isLiveConnected ? '🟢 실시간 연결됨' : '⚪ 폴링 갱신'}
              {lastUpdatedAt ? ` · 마지막 갱신 ${formatUpdatedAt(lastUpdatedAt)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={refreshQuotes}
            disabled={isRefreshing || watchlist.length === 0}
            className="px-4 py-2 rounded-lg border border-green-300 text-green-700 text-sm font-medium hover:bg-green-50 disabled:opacity-50 font-sans"
          >
            {isRefreshing ? '갱신 중...' : '새로고침'}
          </button>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 font-sans">{error}</p>
        )}

        {isLoading ? (
          <p className="text-center py-10 text-gray-500 font-sans">로딩 중...</p>
        ) : watchlist.length === 0 ? (
          <p className="text-center py-10 text-gray-400 font-sans">
            아직 추가한 종목이 없습니다. 위에서 검색해 추가해 보세요.
          </p>
        ) : (
          <div className="space-y-3">
            {watchlist.map((item) => {
              const quote = quotes[item.symbol]
              const isUp = (quote?.change ?? 0) > 0
              const isDown = (quote?.change ?? 0) < 0
              const changeColor = isUp
                ? 'text-red-600'
                : isDown
                  ? 'text-blue-600'
                  : 'text-gray-600'

              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 font-sans">{item.displayName}</p>
                    <p className="text-sm text-gray-500 font-sans">
                      {item.symbol}
                      {item.exchange ? ` · ${item.exchange}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900 font-sans tabular-nums">
                        {quote
                          ? formatStockPrice(quote.currentPrice, item.symbol)
                          : '-'}
                      </p>
                      {quote && (
                        <p className={`text-sm font-medium font-sans tabular-nums ${changeColor}`}>
                          {quote.change > 0 ? '+' : ''}
                          {formatStockPrice(quote.change, item.symbol)} (
                          {formatStockChangePercent(quote.changePercent)})
                          {quote.source === 'websocket' ? ' · 실시간' : ''}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSymbol(item.id, item.displayName)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-white font-sans"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 font-sans">주요 환율</h2>
            <p className="text-sm text-gray-500 font-sans mt-1">
              네이버 금융 기준 (원화)
              {exchangeLastUpdatedAt
                ? ` · 마지막 갱신 ${formatUpdatedAt(exchangeLastUpdatedAt)}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={refreshRates}
            disabled={isExchangeRefreshing}
            className="px-4 py-2 rounded-lg border border-green-300 text-green-700 text-sm font-medium hover:bg-green-50 disabled:opacity-50 font-sans"
          >
            {isExchangeRefreshing ? '갱신 중...' : '새로고침'}
          </button>
        </div>

        {exchangeError && (
          <p className="mb-4 text-sm text-red-600 font-sans">{exchangeError}</p>
        )}

        {isExchangeLoading ? (
          <p className="text-center py-6 text-gray-500 font-sans">환율 로딩 중...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {exchangeItems.map((item) => {
              const quote = exchangeQuotes[item.code]
              const isUp = (quote?.change ?? 0) > 0
              const isDown = (quote?.change ?? 0) < 0
              const changeColor = isUp
                ? 'text-red-600'
                : isDown
                  ? 'text-blue-600'
                  : 'text-gray-600'

              return (
                <div
                  key={item.code}
                  className="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 font-sans">
                      <span className="mr-1.5" aria-hidden>{item.flag}</span>
                      {item.label}
                    </p>
                    <p className="text-sm text-gray-500 font-sans">{item.unitLabel}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-gray-900 font-sans tabular-nums">
                      {quote ? formatExchangePrice(quote.price) : '-'}
                    </p>
                    {quote && (
                      <p className={`text-sm font-medium font-sans tabular-nums ${changeColor}`}>
                        {quote.change > 0 ? '+' : ''}
                        {formatExchangePrice(quote.change)} (
                        {formatExchangeChangePercent(quote.changePercent)})
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-white font-sans">
        환율·국내 시세는 네이버 금융 기준(환율 60초, 주식 약 15초 폴링)이며, 해외 종목은 Finnhub API를 사용합니다. 투자 판단용이 아닌 참고용 정보입니다.
      </p>
    </div>
  )
}
