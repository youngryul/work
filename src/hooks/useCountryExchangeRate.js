import { useCallback, useEffect, useState } from 'react'
import { EXCHANGE_RATE_POLL_INTERVAL_MS } from '../constants/exchangeRates.js'
import { getTravelAbroadMeta } from '../constants/travelAbroad.js'
import {
  fetchExchangeRates,
  mapExchangeQuotesByCode,
} from '../services/exchangeRateService.js'

/**
 * 서버 프록시를 통해 통화 → KRW 환율 조회 (CORS 회피)
 * @param {string} currencyCode
 * @returns {Promise<number|null>}
 */
async function fetchCurrencyToKrwRate(currencyCode) {
  if (!currencyCode || currencyCode === 'KRW') return null
  const response = await fetch(
    `/api/currency-to-krw?from=${encodeURIComponent(currencyCode)}`,
  )
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || '환율을 불러오지 못했습니다.')
  }
  const data = await response.json()
  return typeof data?.rate === 'number' ? data.rate : null
}

/**
 * 국가별 환율 (네이버 우선, 그 외 서버 프록시 폴백)
 * @param {string} countryCode
 */
export function useCountryExchangeRate(countryCode) {
  const meta = getTravelAbroadMeta(countryCode)
  const [ratePerUnit, setRatePerUnit] = useState(null)
  const [unitLabel, setUnitLabel] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  const refresh = useCallback(async () => {
    if (!meta.currencyCode) {
      setRatePerUnit(null)
      setUnitLabel('')
      setError('이 국가의 환율 정보가 아직 없습니다.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      if (meta.naverFxCode) {
        const quotes = await fetchExchangeRates()
        const byCode = mapExchangeQuotesByCode(quotes)
        const quote = byCode[meta.naverFxCode]
        if (quote?.price != null) {
          if (meta.naverFxCode === 'FX_JPYKRW') {
            setRatePerUnit(quote.price / 100)
            setUnitLabel('JPY')
          } else {
            setRatePerUnit(quote.price)
            setUnitLabel(meta.currencyCode)
          }
          setError(null)
          setUpdatedAt(Date.now())
          return
        }
      }

      const rate = await fetchCurrencyToKrwRate(meta.currencyCode)
      if (rate == null) throw new Error('환율을 불러오지 못했습니다.')
      setRatePerUnit(rate)
      setUnitLabel(meta.currencyCode)
      setError(null)
      setUpdatedAt(Date.now())
    } catch (err) {
      console.error('국가 환율 조회 오류:', err)
      setError(err?.message || '환율을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [meta.currencyCode, meta.naverFxCode])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, EXCHANGE_RATE_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  return {
    currencyCode: meta.currencyCode,
    currencyLabel: meta.currencyLabel,
    ratePerUnit,
    unitLabel,
    isLoading,
    error,
    updatedAt,
    refresh,
  }
}
