/**
 * 주식 보유 → 가계부 투자 연동 매핑
 * 해외주식은 기록 통화(USD|KRW)에 따라 저장
 */
import {
  LEDGER_CURRENCIES,
  LEDGER_INVESTMENT_ASSET_TYPES,
  getDefaultLedgerInvestmentCurrency,
  isLedgerInvestmentUsd,
} from '../constants/ledger.js'
import { isKoreanStockSymbol } from '../services/koreanStockService.js'
import { hasStockHoldings } from './stockHoldings.js'

/**
 * @param {string} symbol
 * @returns {string}
 */
export function getLedgerAssetTypeFromStockSymbol(symbol) {
  return isKoreanStockSymbol(symbol)
    ? LEDGER_INVESTMENT_ASSET_TYPES.DOMESTIC_STOCK
    : LEDGER_INVESTMENT_ASSET_TYPES.OVERSEAS_STOCK
}

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
 * 주식 보유 정보를 가계부 투자 upsert 페이로드로 변환
 * @param {{
 *   symbol: string,
 *   displayName: string,
 *   holdingsQuantity: number,
 *   averagePrice: number,
 *   currentPrice?: number | null
 * }} stock
 * @param {{
 *   currency?: string,
 *   usdKrwRate?: number
 * }} [options]
 * @returns {Object|null}
 */
export function buildLedgerInvestmentFromStock(stock, options = {}) {
  if (!hasStockHoldings(stock)) return null

  const quantity = Number(stock.holdingsQuantity)
  const avgPriceRaw = Number(stock.averagePrice)
  const currentRaw =
    Number.isFinite(stock.currentPrice) && stock.currentPrice > 0
      ? Number(stock.currentPrice)
      : avgPriceRaw

  const assetType = getLedgerAssetTypeFromStockSymbol(stock.symbol)
  const currency =
    options.currency || getDefaultLedgerInvestmentCurrency(assetType)
  const asUsd = isLedgerInvestmentUsd(currency)
  // 해외 시세는 달러 기준. 원화 기록 시 환율 곱함
  const fx =
    assetType === LEDGER_INVESTMENT_ASSET_TYPES.OVERSEAS_STOCK && !asUsd
      ? Number(options.usdKrwRate) || 1
      : 1

  const avgPrice = roundMoney(avgPriceRaw * fx, asUsd)
  const currentPrice = roundMoney(currentRaw * fx, asUsd)
  const investedAmount = roundMoney(quantity * avgPrice, asUsd)
  const currentValue = roundMoney(quantity * currentPrice, asUsd)

  return {
    sourceSymbol: stock.symbol,
    assetName: stock.displayName || stock.symbol,
    assetType,
    currency: asUsd ? LEDGER_CURRENCIES.USD : LEDGER_CURRENCIES.KRW,
    quantity,
    avgPrice,
    currentPrice,
    investedAmount,
    currentValue,
  }
}
