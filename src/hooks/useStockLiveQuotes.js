import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FINNHUB_WS_URL,
  STOCK_QUOTE_POLL_INTERVAL_MS,
} from '../constants/stockMarket.js'
import {
  fetchStockQuotes,
  getFinnhubApiKey,
  isStockApiConfigured,
} from '../services/stockMarketService.js'
import { isKoreanStockSymbol } from '../services/koreanStockService.js'
import {
  addStockToWatchlist,
  getMyStockWatchlist,
  removeStockFromWatchlist,
  updateStockHoldings,
} from '../services/stockWatchlistService.js'

/**
 * 관심 종목 + 실시간(폴링·WebSocket) 시세
 * @returns {{
 *   watchlist: import('../services/stockWatchlistService.js').StockWatchlistItem[],
 *   quotes: Record<string, import('../services/stockMarketService.js').StockQuote>,
 *   isLoading: boolean,
 *   isRefreshing: boolean,
 *   lastUpdatedAt: number | null,
 *   isApiConfigured: boolean,
 *   isLiveConnected: boolean,
 *   error: string | null,
 *   reloadWatchlist: () => Promise<void>,
 *   addSymbol: (item: { symbol: string, displayName: string, exchange?: string | null }) => Promise<void>,
 *   removeSymbol: (id: string) => Promise<void>,
 *   updateHoldings: (id: string, holdings: { holdingsQuantity?: number | null, averagePrice?: number | null }) => Promise<void>,
 *   refreshQuotes: () => Promise<void>,
 * }}
 */
export function useStockLiveQuotes() {
  const [watchlist, setWatchlist] = useState([])
  const [quotes, setQuotes] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [error, setError] = useState(null)
  const [isLiveConnected, setIsLiveConnected] = useState(false)
  const wsRef = useRef(null)

  const symbols = useMemo(() => watchlist.map((item) => item.symbol), [watchlist])
  const isApiConfigured = isStockApiConfigured()

  const refreshQuotes = useCallback(async () => {
    if (symbols.length === 0) return
    const needsFinnhub = symbols.some((symbol) => !isKoreanStockSymbol(symbol))
    if (needsFinnhub && !isApiConfigured) return

    setIsRefreshing(true)
    try {
      const nextQuotes = await fetchStockQuotes(symbols)
      setQuotes((prev) => ({ ...prev, ...nextQuotes }))
      setLastUpdatedAt(Date.now())
      setError(null)
    } catch (err) {
      console.error('시세 새로고침 오류:', err)
      setError(err?.message || '시세를 불러오지 못했습니다.')
    } finally {
      setIsRefreshing(false)
    }
  }, [isApiConfigured, symbols])

  const reloadWatchlist = useCallback(async () => {
    setIsLoading(true)
    try {
      const items = await getMyStockWatchlist()
      setWatchlist(items)
      setError(null)
    } catch (err) {
      console.error('관심 종목 로드 오류:', err)
      setError(err?.message || '관심 종목을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    reloadWatchlist()
  }, [reloadWatchlist])

  useEffect(() => {
    if (symbols.length === 0) return undefined

    const needsFinnhub = symbols.some((symbol) => !isKoreanStockSymbol(symbol))
    if (needsFinnhub && !isApiConfigured) {
      const hasKoreanOnly = symbols.some((symbol) => isKoreanStockSymbol(symbol))
      if (!hasKoreanOnly) return undefined
    }

    refreshQuotes()
    const timer = window.setInterval(refreshQuotes, STOCK_QUOTE_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [isApiConfigured, symbols, refreshQuotes])

  useEffect(() => {
    const token = getFinnhubApiKey()
    const wsSymbols = symbols.filter((symbol) => !isKoreanStockSymbol(symbol))
    if (!token || wsSymbols.length === 0) {
      setIsLiveConnected(false)
      return undefined
    }

    const ws = new WebSocket(`${FINNHUB_WS_URL}?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      setIsLiveConnected(true)
      wsSymbols.forEach((symbol) => {
        ws.send(JSON.stringify({ type: 'subscribe', symbol }))
      })
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type !== 'trade' || !Array.isArray(message.data)) return

        setQuotes((prev) => {
          const next = { ...prev }
          message.data.forEach((trade) => {
            const symbol = trade.s
            const price = trade.p
            if (!symbol || !Number.isFinite(price)) return

            const existing = next[symbol]
            const previousClose = existing?.previousClose ?? price
            const change = price - previousClose
            const changePercent = previousClose ? (change / previousClose) * 100 : 0

            next[symbol] = {
              symbol,
              currentPrice: price,
              change,
              changePercent,
              high: existing?.high ?? price,
              low: existing?.low ?? price,
              open: existing?.open ?? price,
              previousClose,
              updatedAt: trade.t || Date.now(),
              source: 'websocket',
            }
          })
          return next
        })
        setLastUpdatedAt(Date.now())
      } catch (parseError) {
        console.error('WebSocket 메시지 파싱 오류:', parseError)
      }
    }

    ws.onclose = () => setIsLiveConnected(false)
    ws.onerror = () => setIsLiveConnected(false)

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [symbols.join('|')])

  const addSymbol = useCallback(async (item) => {
    const created = await addStockToWatchlist(item)
    setWatchlist((prev) => [...prev, created])
  }, [])

  const removeSymbol = useCallback(async (id) => {
    const target = watchlist.find((item) => item.id === id)
    await removeStockFromWatchlist(id)
    setWatchlist((prev) => prev.filter((item) => item.id !== id))
    if (target) {
      setQuotes((prev) => {
        const next = { ...prev }
        delete next[target.symbol]
        return next
      })
    }
  }, [watchlist])

  const updateHoldings = useCallback(async (id, holdings) => {
    const updated = await updateStockHoldings(id, holdings)
    setWatchlist((prev) => prev.map((item) => (item.id === id ? updated : item)))
  }, [])

  return {
    watchlist,
    quotes,
    isLoading,
    isRefreshing,
    lastUpdatedAt,
    isApiConfigured,
    isLiveConnected,
    error,
    reloadWatchlist,
    addSymbol,
    removeSymbol,
    updateHoldings,
    refreshQuotes,
  }
}
