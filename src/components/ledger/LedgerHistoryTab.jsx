import { useEffect, useMemo, useState } from 'react'
import {
  LEDGER_TRANSACTION_FILTER_OPTIONS,
  LEDGER_ADD_BUTTON_CLASS,
  LEDGER_TRANSACTION_TYPES,
  formatLedgerAmount,
  formatLedgerSignedAmount,
  getLedgerTransactionTypeLabel,
} from '../../constants/ledger.js'
import { formatLedgerDateLabel, getPeriodRanges, toDateString } from '../../utils/ledgerPeriod.js'
import { deleteTransaction, getTransactions } from '../../services/ledgerService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 거래 내역 탭
 * @param {{
 *   refreshKey: number,
 *   categories: Object[],
 *   accounts: Object[],
 *   onAddTransaction?: () => void,
 *   onEditTransaction: (tx: Object) => void,
 *   onChanged: () => void
 * }} props
 */
export default function LedgerHistoryTab({
  refreshKey,
  categories,
  accounts,
  onAddTransaction,
  onEditTransaction,
  onChanged,
}) {
  const monthRanges = useMemo(() => getPeriodRanges('month'), [])
  const [startDate, setStartDate] = useState(monthRanges.current.startDate)
  const [endDate, setEndDate] = useState(toDateString(new Date()))
  const [typeFilter, setTypeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const data = await getTransactions({
          startDate,
          endDate,
          type: typeFilter || undefined,
          categoryId: categoryFilter || undefined,
          accountId: accountFilter || undefined,
        })
        if (!cancelled) setTransactions(data)
      } catch (error) {
        if (!cancelled) {
          showToast(error.message || '내역을 불러오지 못했어요.', TOAST_TYPES.ERROR)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [refreshKey, startDate, endDate, typeFilter, categoryFilter, accountFilter])

  const grouped = useMemo(() => {
    /** @type {Map<string, Object[]>} */
    const map = new Map()
    transactions.forEach((tx) => {
      const key = tx.transactionDate
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(tx)
    })
    return [...map.entries()]
  }, [transactions])

  const handleDelete = async (tx) => {
    if (!window.confirm('이 거래를 삭제할까요?')) return
    try {
      await deleteTransaction(tx.id)
      showToast('거래를 삭제했어요.', TOAST_TYPES.INFO)
      onChanged()
    } catch (error) {
      showToast(error.message || '삭제에 실패했어요.', TOAST_TYPES.ERROR)
    }
  }

  const amountDisplay = (tx) => {
    if (tx.type === LEDGER_TRANSACTION_TYPES.INCOME) {
      return (
        <span className="text-green-600 font-semibold">
          {formatLedgerSignedAmount(tx.amount)}
        </span>
      )
    }
    if (tx.type === LEDGER_TRANSACTION_TYPES.EXPENSE) {
      return (
        <span className="text-gray-800 font-semibold">
          -{formatLedgerAmount(tx.amount).replace('원', '')}원
        </span>
      )
    }
    return (
      <span className="text-gray-500 font-semibold">
        {formatLedgerAmount(tx.amount)}
      </span>
    )
  }

  const titleFor = (tx) => {
    if (tx.memo) return tx.memo
    if (tx.type === LEDGER_TRANSACTION_TYPES.TRANSFER) {
      return `${tx.accountName || '계좌'} → ${tx.toAccountName || '계좌'}`
    }
    return tx.categoryName || getLedgerTransactionTypeLabel(tx.type)
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-gray-500 min-w-0">
          {formatLedgerDateLabel(startDate)} – {formatLedgerDateLabel(endDate)}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
              showFilters
                ? 'bg-green-500 text-white border-green-500'
                : 'bg-white text-green-700 border-green-300 hover:bg-green-50'
            }`}
          >
            {showFilters ? '필터 닫기' : '필터'}
          </button>
          {onAddTransaction && (
            <button
              type="button"
              onClick={onAddTransaction}
              className={LEDGER_ADD_BUTTON_CLASS}
            >
              + 추가
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">시작</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">종료</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">유형</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">전체</option>
              {LEDGER_TRANSACTION_FILTER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">카테고리</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">전체</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">계좌</label>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">전체</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 py-8 text-center">불러오는 중…</p>
      ) : grouped.length === 0 ? (
        <p className="text-gray-500 py-10 text-center">거래 내역이 없어요.</p>
      ) : (
        grouped.map(([date, items]) => (
          <section key={date}>
            <h3 className="text-sm font-semibold text-gray-500 mb-2 sticky top-0 bg-white/90 backdrop-blur py-1">
              {formatLedgerDateLabel(date)}
            </h3>
            <ul className="divide-y divide-gray-100">
              {items.map((tx) => (
                <li
                  key={tx.id}
                  className="py-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded-lg"
                  onClick={() => onEditTransaction(tx)}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{titleFor(tx)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {tx.categoryName || getLedgerTransactionTypeLabel(tx.type)}
                      {tx.paymentMethod ? ` · ${tx.paymentMethod}` : ''}
                      {tx.type === LEDGER_TRANSACTION_TYPES.TRANSFER ||
                      tx.type === LEDGER_TRANSACTION_TYPES.INVESTMENT
                        ? ' · 소비 제외'
                        : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {amountDisplay(tx)}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(tx)
                      }}
                      className="block ml-auto mt-1 text-xs text-gray-300 hover:text-rose-500"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
