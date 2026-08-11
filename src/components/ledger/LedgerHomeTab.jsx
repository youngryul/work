import { useEffect, useState } from 'react'
import {
  LEDGER_ACCOUNT_TYPES,
  formatLedgerAmount,
  formatLedgerSignedAmount,
} from '../../constants/ledger.js'
import { getPeriodRanges } from '../../utils/ledgerPeriod.js'
import { buildHomeDashboard, getCategoryHighlights } from '../../utils/ledgerAnalysis.js'
import { getNetWorthSummary, getTransactions } from '../../services/ledgerService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 가계부 홈 대시보드
 * @param {{ refreshKey: number }} props
 */
export default function LedgerHomeTab({ refreshKey }) {
  const [dashboard, setDashboard] = useState(null)
  const [assetSummary, setAssetSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const ranges = getPeriodRanges('month')
        const [currentTxs, previousTxs, netWorth] = await Promise.all([
          getTransactions({
            startDate: ranges.current.startDate,
            endDate: ranges.current.endDate,
          }),
          getTransactions({
            startDate: ranges.previous.startDate,
            endDate: ranges.previous.endDate,
          }),
          getNetWorthSummary(),
        ])
        if (cancelled) return
        setDashboard(buildHomeDashboard(currentTxs, previousTxs))
        setAssetSummary(netWorth)
      } catch (error) {
        if (!cancelled) {
          showToast(error.message || '홈 데이터를 불러오지 못했어요.', TOAST_TYPES.ERROR)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (loading && !dashboard) {
    return <p className="text-gray-500 py-8 text-center">불러오는 중…</p>
  }

  if (!dashboard) return null

  const { expense, income, savings, remaining, summary, categoryComparisons } = dashboard
  const highlights = getCategoryHighlights(categoryComparisons)
  const rateText =
    expense.changeRate === null
      ? '비교할 지난달 지출이 없어요'
      : `${expense.changeRate > 0 ? '↑' : expense.changeRate < 0 ? '↓' : '→'} ${Math.abs(expense.changeRate).toFixed(1)}%`

  const accounts = assetSummary?.accounts || []
  const cashTotal = accounts
    .filter((a) => a.type === LEDGER_ACCOUNT_TYPES.CASH)
    .reduce((sum, a) => sum + (Number(a.balanceKrw ?? a.balance) || 0), 0)
  const bankTotal = accounts
    .filter((a) => a.type === LEDGER_ACCOUNT_TYPES.BANK)
    .reduce((sum, a) => sum + (Number(a.balanceKrw ?? a.balance) || 0), 0)
  const totalAssets = assetSummary?.totalAssets || 0

  return (
    <div className="space-y-8 pb-4">
      <section>
        <p className="text-sm text-gray-500 mb-1">총 자산</p>
        <p className="text-4xl font-semibold text-gray-900 tracking-tight">
          {formatLedgerAmount(totalAssets)}
        </p>
        <p className="mt-2 text-sm text-gray-500">
          현금 {formatLedgerAmount(cashTotal)}
          {' · '}
          적금 {formatLedgerAmount(bankTotal)}
        </p>
      </section>

      <section>
        <p className="text-sm text-gray-500 mb-1">이번 달 소비</p>
        <p className="text-3xl font-semibold text-gray-900 tracking-tight">
          {formatLedgerAmount(expense.currentAmount)}
        </p>
        <p
          className={`mt-2 text-base font-medium ${
            expense.difference < 0
              ? 'text-green-600'
              : expense.difference > 0
                ? 'text-rose-500'
                : 'text-gray-500'
          }`}
        >
          {rateText}
        </p>
        <p className="mt-1 text-gray-600 text-sm">{summary.headline}</p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <p className="text-sm text-gray-500 mb-1">이번 달 수입</p>
          <p className="text-xl font-semibold text-gray-800">
            {formatLedgerAmount(income)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-1">저축/투자</p>
          <p className="text-xl font-semibold text-gray-800">
            {formatLedgerAmount(savings)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 mb-1">잔여금액</p>
          <p
            className={`text-xl font-semibold ${
              remaining >= 0 ? 'text-green-700' : 'text-rose-600'
            }`}
          >
            {formatLedgerAmount(remaining)}
          </p>
        </div>
      </section>

      {(highlights.mostDecreased || highlights.mostIncreased) && (
        <section className="space-y-2">
          <p className="text-sm text-gray-500">무엇이 변했나요</p>
          {highlights.mostDecreased && (
            <p className="text-gray-700">
              {highlights.mostDecreased.category}{' '}
              <span className="text-green-600 font-medium">
                ↓ {formatLedgerAmount(Math.abs(highlights.mostDecreased.difference))}
              </span>
            </p>
          )}
          {highlights.mostIncreased && (
            <p className="text-gray-700">
              {highlights.mostIncreased.category}{' '}
              <span className="text-rose-500 font-medium">
                ↑ {formatLedgerAmount(highlights.mostIncreased.difference)}
              </span>
            </p>
          )}
        </section>
      )}

      {expense.previousAmount > 0 && (
        <p className="text-xs text-gray-400">
          지난달 소비 {formatLedgerAmount(expense.previousAmount)}
          {' · '}
          전월 대비 {formatLedgerSignedAmount(expense.difference)}
        </p>
      )}
    </div>
  )
}
