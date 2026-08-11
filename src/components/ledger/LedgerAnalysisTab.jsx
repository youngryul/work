import { useEffect, useState } from 'react'
import {
  LEDGER_PERIOD_UNITS,
  LEDGER_PERIOD_UNIT_TABS,
  formatLedgerAmount,
  formatLedgerSignedAmount,
} from '../../constants/ledger.js'
import { getPeriodRanges } from '../../utils/ledgerPeriod.js'
import {
  buildSpendingSummary,
  compareByCategory,
  compareTotals,
  sumExpenses,
  sumFixedVariable,
} from '../../utils/ledgerAnalysis.js'
import { getTransactions } from '../../services/ledgerService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 기간별 소비 분석 탭
 * @param {{ refreshKey: number }} props
 */
export default function LedgerAnalysisTab({ refreshKey }) {
  const [periodUnit, setPeriodUnit] = useState(LEDGER_PERIOD_UNITS.WEEK)
  const [loading, setLoading] = useState(true)
  const [labels, setLabels] = useState({ current: '', previous: '' })
  const [totalComparison, setTotalComparison] = useState(null)
  const [categoryComparisons, setCategoryComparisons] = useState([])
  const [summary, setSummary] = useState(null)
  const [fixedVariable, setFixedVariable] = useState({ fixed: 0, variable: 0, total: 0 })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const ranges = getPeriodRanges(periodUnit)
        const [currentTxs, previousTxs] = await Promise.all([
          getTransactions({
            startDate: ranges.current.startDate,
            endDate: ranges.current.endDate,
          }),
          getTransactions({
            startDate: ranges.previous.startDate,
            endDate: ranges.previous.endDate,
          }),
        ])
        if (cancelled) return

        const currentExpense = sumExpenses(currentTxs)
        const previousExpense = sumExpenses(previousTxs)
        const comparison = compareTotals(currentExpense, previousExpense)
        const categories = compareByCategory(currentTxs, previousTxs)
        const spendingSummary = buildSpendingSummary({
          periodUnit,
          totalComparison: comparison,
          categoryComparisons: categories,
        })

        setLabels(ranges.labels)
        setTotalComparison(comparison)
        setCategoryComparisons(categories)
        setSummary(spendingSummary)
        setFixedVariable(sumFixedVariable(currentTxs))
      } catch (error) {
        if (!cancelled) {
          showToast(error.message || '분석 데이터를 불러오지 못했어요.', TOAST_TYPES.ERROR)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [refreshKey, periodUnit])

  const rateLabel = (changeRate) => {
    if (changeRate === null) return '—'
    const sign = changeRate > 0 ? '+' : ''
    return `${sign}${changeRate.toFixed(1)}%`
  }

  return (
    <div className="space-y-8 pb-4">
      <div className="inline-flex rounded-full bg-gray-100 p-1">
        {LEDGER_PERIOD_UNIT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPeriodUnit(tab.id)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              periodUnit === tab.id
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && !totalComparison ? (
        <p className="text-gray-500 py-8 text-center">불러오는 중…</p>
      ) : (
        <>
          {summary && (
            <section className="space-y-2">
              <p className="text-lg text-gray-800 font-medium leading-relaxed">
                {summary.headline}
              </p>
              {summary.details.map((line) => (
                <p key={line} className="text-sm text-gray-500">
                  {line}
                </p>
              ))}
            </section>
          )}

          {totalComparison && (
            <section>
              <p className="text-sm text-gray-500 mb-1">{labels.current} 지출</p>
              <p className="text-3xl font-semibold text-gray-900">
                {formatLedgerAmount(totalComparison.currentAmount)}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                <span>
                  {labels.previous}{' '}
                  {formatLedgerAmount(totalComparison.previousAmount)}
                </span>
                <span
                  className={
                    totalComparison.difference < 0
                      ? 'text-green-600'
                      : totalComparison.difference > 0
                        ? 'text-rose-500'
                        : 'text-gray-500'
                  }
                >
                  변화 {formatLedgerSignedAmount(totalComparison.difference)} (
                  {rateLabel(totalComparison.changeRate)})
                </span>
              </div>
            </section>
          )}

          <section>
            <p className="text-sm text-gray-500 mb-1">이번 기간 총지출</p>
            <p className="text-xl font-semibold text-gray-800 mb-3">
              {formatLedgerAmount(fixedVariable.total)}
            </p>
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-gray-400">고정비</p>
                <p className="font-medium text-gray-700">
                  {formatLedgerAmount(fixedVariable.fixed)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">변동비</p>
                <p className="font-medium text-gray-700">
                  {formatLedgerAmount(fixedVariable.variable)}
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-500 mb-3">카테고리별 증감</h3>
            {categoryComparisons.length === 0 ? (
              <p className="text-gray-400 text-sm">비교할 지출이 없어요.</p>
            ) : (
              <ul className="space-y-4">
                {categoryComparisons.map((row) => (
                  <li key={row.categoryId || row.category} className="border-b border-gray-50 pb-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium text-gray-800">{row.category}</p>
                      <p
                        className={`text-sm font-semibold ${
                          row.difference < 0
                            ? 'text-green-600'
                            : row.difference > 0
                              ? 'text-rose-500'
                              : 'text-gray-500'
                        }`}
                      >
                        {formatLedgerSignedAmount(row.difference)} (
                        {rateLabel(row.changeRate)})
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {labels.current} {formatLedgerAmount(row.currentAmount)}
                      {' · '}
                      {labels.previous} {formatLedgerAmount(row.previousAmount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
