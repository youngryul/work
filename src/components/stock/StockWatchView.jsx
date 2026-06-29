import { useEffect, useMemo, useState } from 'react'
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
import {
  calculateStockProfitLoss,
  formatStockProfitLoss,
  formatStockProfitLossPercent,
  hasStockHoldings,
  parseHoldingsNumber,
} from '../../utils/stockHoldings.js'
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
    updateHoldings,
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
  const [holdingsDraft, setHoldingsDraft] = useState({})
  const [savingHoldingsId, setSavingHoldingsId] = useState(null)
  const [expandedHoldingsIds, setExpandedHoldingsIds] = useState(() => new Set())

  const holdingsItems = useMemo(
    () => watchlist.filter((item) => hasStockHoldings(item)),
    [watchlist],
  )

  const interestItems = useMemo(
    () => watchlist.filter((item) => !hasStockHoldings(item)),
    [watchlist],
  )

  const totalHoldingsProfitLoss = useMemo(() => {
    return holdingsItems.reduce((sum, item) => {
      const quote = quotes[item.symbol]
      const result = calculateStockProfitLoss(
        quote?.currentPrice,
        item.averagePrice,
        item.holdingsQuantity,
      )
      return sum + (result?.profitLoss ?? 0)
    }, 0)
  }, [holdingsItems, quotes])

  useEffect(() => {
    const next = {}
    watchlist.forEach((item) => {
      next[item.id] = {
        quantity: item.holdingsQuantity != null ? String(item.holdingsQuantity) : '',
        averagePrice: item.averagePrice != null ? String(item.averagePrice) : '',
      }
    })
    setHoldingsDraft(next)
  }, [watchlist])

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

  const handleHoldingsDraftChange = (id, field, value) => {
    setHoldingsDraft((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }))
  }

  const isHoldingsFormExpanded = (id) => expandedHoldingsIds.has(id)

  const toggleHoldingsForm = (id) => {
    setExpandedHoldingsIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const collapseHoldingsForm = (id) => {
    setExpandedHoldingsIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleSaveHoldings = async (item) => {
    const draft = holdingsDraft[item.id] || { quantity: '', averagePrice: '' }
    const quantity = parseHoldingsNumber(draft.quantity)
    const averagePrice = parseHoldingsNumber(draft.averagePrice)

    if ((quantity && !averagePrice) || (!quantity && averagePrice)) {
      showToast('보유량과 평단가를 함께 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    setSavingHoldingsId(item.id)
    try {
      await updateHoldings(item.id, {
        holdingsQuantity: quantity,
        averagePrice,
      })
      collapseHoldingsForm(item.id)
      showToast(
        quantity && averagePrice ? '보유 주식으로 등록되었습니다.' : '보유 정보가 저장되었습니다.',
        TOAST_TYPES.SUCCESS,
      )
    } catch (err) {
      showToast(err?.message || '보유 정보 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setSavingHoldingsId(null)
    }
  }

  const handleClearHoldings = async (item) => {
    setSavingHoldingsId(item.id)
    try {
      await updateHoldings(item.id, {
        holdingsQuantity: null,
        averagePrice: null,
      })
      collapseHoldingsForm(item.id)
      showToast('보유 정보를 해제했습니다. 관심 종목으로 이동합니다.', TOAST_TYPES.SUCCESS)
    } catch (err) {
      showToast(err?.message || '보유 해제에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setSavingHoldingsId(null)
    }
  }

  const getQuoteChangeColor = (quote) => {
    const isUp = (quote?.change ?? 0) > 0
    const isDown = (quote?.change ?? 0) < 0
    if (isUp) return 'text-red-600'
    if (isDown) return 'text-blue-600'
    return 'text-gray-600'
  }

  const getProfitLossColor = (value) => {
    if (value > 0) return 'text-red-600'
    if (value < 0) return 'text-blue-600'
    return 'text-gray-600'
  }

  const renderQuoteSummary = (item, quote) => (
    <div className="text-right shrink-0">
      <p className="text-2xl font-bold text-gray-900 font-sans tabular-nums">
        {quote ? formatStockPrice(quote.currentPrice, item.symbol) : '-'}
      </p>
      {quote && (
        <p className={`text-sm font-medium font-sans tabular-nums ${getQuoteChangeColor(quote)}`}>
          {quote.change > 0 ? '+' : ''}
          {formatStockPrice(quote.change, item.symbol)} (
          {formatStockChangePercent(quote.changePercent)})
          {quote.source === 'websocket' ? ' · 실시간' : ''}
        </p>
      )}
    </div>
  )

  const renderHoldingsForm = (item, { showCancel = false } = {}) => {
    const draft = holdingsDraft[item.id] || { quantity: '', averagePrice: '' }
    const quantity = parseHoldingsNumber(draft.quantity)
    const averagePrice = parseHoldingsNumber(draft.averagePrice)
    const quote = quotes[item.symbol]
    const profitLossResult = quote
      ? calculateStockProfitLoss(quote.currentPrice, averagePrice, quantity)
      : null

    return (
      <div className="pt-3 border-t border-gray-200 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-gray-600 mb-1 font-sans">
              보유량
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={draft.quantity}
              onChange={(e) => handleHoldingsDraftChange(item.id, 'quantity', e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-sans tabular-nums"
            />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs font-medium text-gray-600 mb-1 font-sans">
              평단가
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={draft.averagePrice}
              onChange={(e) => handleHoldingsDraftChange(item.id, 'averagePrice', e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-sans tabular-nums"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSaveHoldings(item)}
            disabled={savingHoldingsId === item.id}
            className="px-3 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 font-sans"
          >
            {savingHoldingsId === item.id ? '저장 중...' : '저장'}
          </button>
          {showCancel && (
            <button
              type="button"
              onClick={() => collapseHoldingsForm(item.id)}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-white font-sans"
            >
              취소
            </button>
          )}
        </div>
        {profitLossResult && (
          <div className={`text-sm font-semibold font-sans tabular-nums ${getProfitLossColor(profitLossResult.profitLoss)}`}>
            예상 평가손익 {formatStockProfitLoss(profitLossResult.profitLoss, item.symbol)}
            {' '}
            ({formatStockProfitLossPercent(profitLossResult.profitLossPercent)})
          </div>
        )}
      </div>
    )
  }

  const renderHoldingsFormToggle = (item, { variant = 'default' } = {}) => {
    const isExpanded = isHoldingsFormExpanded(item.id)
    const label = variant === 'interest'
      ? (isExpanded ? '접기 ▲' : '보유 등록 ▼')
      : (isExpanded ? '보유 정보 접기 ▲' : '보유량·평단가 ▼')
    const buttonClass = isExpanded
      ? 'px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 font-sans whitespace-nowrap'
      : variant === 'interest'
        ? 'px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 font-sans whitespace-nowrap'
        : 'px-3 py-1.5 rounded-lg border border-emerald-400 bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 font-sans whitespace-nowrap'

    return (
      <button
        type="button"
        onClick={() => toggleHoldingsForm(item.id)}
        className={buttonClass}
        aria-expanded={isExpanded}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <ViewPageTitle icon="📈" title="주식 확인">
        <p className="text-xl text-gray-600">
          관심 종목 시세를 확인하고, 보유 주식은 평단가 기준 손익을 확인하세요.
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
            <h2 className="text-xl font-bold text-gray-800 font-sans">보유 주식</h2>
            <p className="text-sm text-gray-500 font-sans mt-1">
              보유량·평단가를 입력한 종목 · {holdingsItems.length}종목
              {holdingsItems.length > 0 && Number.isFinite(totalHoldingsProfitLoss) && (
                <span className={`ml-2 font-semibold tabular-nums ${getProfitLossColor(totalHoldingsProfitLoss)}`}>
                  총 평가손익 {formatStockProfitLoss(totalHoldingsProfitLoss)}
                </span>
              )}
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
        ) : holdingsItems.length === 0 ? (
          <p className="text-center py-10 text-gray-400 font-sans">
            등록된 보유 주식이 없습니다. 관심 종목에서 보유 등록을 해 보세요.
          </p>
        ) : (
          <div className="space-y-3">
            {holdingsItems.map((item) => {
              const quote = quotes[item.symbol]
              const profitLossResult = quote
                ? calculateStockProfitLoss(
                    quote.currentPrice,
                    item.averagePrice,
                    item.holdingsQuantity,
                  )
                : null

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 font-sans">{item.displayName}</p>
                      <p className="text-sm text-gray-500 font-sans">
                        {item.symbol}
                        {item.exchange ? ` · ${item.exchange}` : ''}
                      </p>
                      <p className="text-sm text-emerald-800 font-medium font-sans mt-1 tabular-nums">
                        {item.holdingsQuantity}주 · 평단 {formatStockPrice(item.averagePrice, item.symbol)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {renderQuoteSummary(item, quote)}
                      <div className="flex flex-col gap-2">
                        {renderHoldingsFormToggle(item)}
                        <button
                          type="button"
                          onClick={() => handleClearHoldings(item)}
                          disabled={savingHoldingsId === item.id}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-white font-sans whitespace-nowrap"
                        >
                          보유 해제
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSymbol(item.id, item.displayName)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50 font-sans"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>

                  {profitLossResult && (
                    <div className={`text-base font-bold font-sans tabular-nums ${getProfitLossColor(profitLossResult.profitLoss)}`}>
                      평가손익 {formatStockProfitLoss(profitLossResult.profitLoss, item.symbol)}
                      {' '}
                      ({formatStockProfitLossPercent(profitLossResult.profitLossPercent)})
                    </div>
                  )}

                  {isHoldingsFormExpanded(item.id) && renderHoldingsForm(item)}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 font-sans">관심 종목</h2>
            <p className="text-sm text-gray-500 font-sans mt-1">
              {isLiveConnected ? '🟢 실시간 연결됨' : '⚪ 폴링 갱신'}
              {lastUpdatedAt ? ` · 마지막 갱신 ${formatUpdatedAt(lastUpdatedAt)}` : ''}
              {' · '}{interestItems.length}종목
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-center py-10 text-gray-500 font-sans">로딩 중...</p>
        ) : interestItems.length === 0 ? (
          <p className="text-center py-10 text-gray-400 font-sans">
            관심 종목이 없습니다. 위에서 검색해 추가해 보세요.
          </p>
        ) : (
          <div className="space-y-3">
            {interestItems.map((item) => {
              const quote = quotes[item.symbol]
              const isExpanded = isHoldingsFormExpanded(item.id)

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 font-sans">{item.displayName}</p>
                      <p className="text-sm text-gray-500 font-sans">
                        {item.symbol}
                        {item.exchange ? ` · ${item.exchange}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {renderQuoteSummary(item, quote)}
                      <div className="flex flex-col gap-2">
                        {renderHoldingsFormToggle(item, { variant: 'interest' })}
                        <button
                          type="button"
                          onClick={() => handleRemoveSymbol(item.id, item.displayName)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 text-sm hover:bg-white font-sans"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && renderHoldingsForm(item, { showCancel: true })}
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
