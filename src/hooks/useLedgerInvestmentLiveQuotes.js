import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FINNHUB_WS_URL,
  STOCK_QUOTE_POLL_INTERVAL_MS,
} from '../constants/stockMarket.js'
import {
  LEDGER_INVESTMENT_ASSET_TYPES,
  isLedgerInvestmentUsd,
  resolveLedgerInvestmentCurrency,
} from '../constants/ledger.js'
import {
  fetchStockQuotes,
  getFinnhubApiKey,
  isStockApiConfigured,
} from '../services/stockMarketService.js'
import { isKoreanStockSymbol } from '../services/koreanStockService.js'

/**
 * @param {number} value
 * @param {boolean} asUsd
 * @returns {number}
 */
function roundMoney(value, asUsd) {
  const num = Number(value) || 0
  if (asUsd) return Math.round(num * 100) / 100
  return Math.round(num)
}

/**
 * 가계부 투자(주식 연동) 실시간 시세 — 주식 확인과 동일 API/폴링
 * @param {Array<{ sourceSymbol?: string|null, quantity?: number, investedAmount?: number, assetType?: string, currency?: string, currentPrice?: number, currentValue?: number }>} investments
 * @param {{ usdKrwRate?: number }} [options]
 */
export function useLedgerInvestmentLiveQuotes(investments, options = {}) {
  const usdKrwRate = Number(options.usdKrwRate) > 0 ? Number(options.usdKrwRate) : 1
  const [quotes, setQuotes] = useState({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [isLiveConnected, setIsLiveConnected] = useState(false)
  const wsRef = useRef(null)

  const symbols = useMemo(() => {
    const set = new Set()
    investments.forEach((item) => {
      if (item.sourceSymbol && Number(item.quantity) > 0) {
        set.add(item.sourceSymbol)
      }
    })
    return [...set]
  }, [investments])

  const isApiConfigured = isStockApiConfigured()

  const refreshQuotes = useCallback(async () => {
    if (symbols.length === 0) return
    const needsFinnhub = symbols.some((symbol) => !isKoreanStockSymbol(symbol))
    if (needsFinnhub && !isApiConfigured) {
      const hasKorean = symbols.some((symbol) => isKoreanStockSymbol(symbol))
      if (!hasKorean) return
    }

    setIsRefreshing(true)
    try {
      const nextQuotes = await fetchStockQuotes(symbols)
      setQuotes((prev) => ({ ...prev, ...nextQuotes }))
      setLastUpdatedAt(Date.now())
    } catch (error) {
      console.warn('투자 시세 갱신 실패:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [isApiConfigured, symbols])

  useEffect(() => {
    if (symbols.length === 0) return undefined
    refreshQuotes()
    const timer = window.setInterval(refreshQuotes, STOCK_QUOTE_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [symbols, refreshQuotes])

  // 해외주식 WebSocket (주식 확인과 동일)
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
            if (!trade?.s || !Number.isFinite(trade.p)) return
            const prevQuote = next[trade.s]
            next[trade.s] = {
              symbol: trade.s,
              currentPrice: trade.p,
              change: prevQuote?.change ?? 0,
              changePercent: prevQuote?.changePercent ?? 0,
              high: prevQuote?.high ?? trade.p,
              low: prevQuote?.low ?? trade.p,
              open: prevQuote?.open ?? trade.p,
              previousClose: prevQuote?.previousClose ?? trade.p,
              updatedAt: trade.t || Date.now(),
              source: 'websocket',
            }
          })
          return next
        })
        setLastUpdatedAt(Date.now())
      } catch (error) {
        console.warn('투자 WebSocket 파싱 오류:', error)
      }
    }

    ws.onclose = () => setIsLiveConnected(false)
    ws.onerror = () => setIsLiveConnected(false)

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [symbols.join('|')])

  const liveInvestments = useMemo(() => {
    return investments.map((item) => {
      if (!item.sourceSymbol || !(Number(item.quantity) > 0)) return item
      const quote = quotes[item.sourceSymbol]
      if (!quote?.currentPrice || !(quote.currentPrice > 0)) return item

      const currency = resolveLedgerInvestmentCurrency(item)
      const asUsd = isLedgerInvestmentUsd(currency)
      const isOverseas =
        item.assetType === LEDGER_INVESTMENT_ASSET_TYPES.OVERSEAS_STOCK ||
        !isKoreanStockSymbol(item.sourceSymbol)
      // 해외 시세(달러) → 원화 기록이면 환율 적용
      const fx = isOverseas && !asUsd ? usdKrwRate : 1
      const currentPrice = roundMoney(quote.currentPrice * fx, asUsd)
      const currentValue = roundMoney(Number(item.quantity) * currentPrice, asUsd)
      const investedAmount = Number(item.investedAmount) || 0
      const profit = roundMoney(currentValue - investedAmount, asUsd)
      const profitRate =
        investedAmount === 0 ? null : (profit / investedAmount) * 100

      return {
        ...item,
        currency,
        currentPrice,
        currentValue,
        profit,
        profitRate: profitRate === null ? null : Math.round(profitRate * 100) / 100,
        isLiveQuote: true,
      }
    })
  }, [investments, quotes, usdKrwRate])

  return {
    liveInvestments,
    quotes,
    isRefreshing,
    lastUpdatedAt,
    isLiveConnected,
    refreshQuotes,
  }
}
