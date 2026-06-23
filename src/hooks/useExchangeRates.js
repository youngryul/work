import { useCallback, useEffect, useState } from 'react'
import { EXCHANGE_RATE_POLL_INTERVAL_MS } from '../constants/exchangeRates.js'
import {
  EXCHANGE_RATE_ITEMS,
  fetchExchangeRates,
  mapExchangeQuotesByCode,
} from '../services/exchangeRateService.js'

/**
 * 주요 환율 실시간(폴링) 조회
 */
export function useExchangeRates() {
  const [quotesByCode, setQuotesByCode] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [error, setError] = useState(null)

  const refreshRates = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const quotes = await fetchExchangeRates()
      setQuotesByCode(mapExchangeQuotesByCode(quotes))
      setLastUpdatedAt(Date.now())
      setError(null)
    } catch (err) {
      console.error('환율 조회 오류:', err)
      setError(err?.message || '환율을 불러오지 못했습니다.')
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshRates()
    const timer = window.setInterval(refreshRates, EXCHANGE_RATE_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [refreshRates])

  return {
    items: EXCHANGE_RATE_ITEMS,
    quotesByCode,
    isLoading,
    isRefreshing,
    lastUpdatedAt,
    error,
    refreshRates,
  }
}
