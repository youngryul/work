import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  LEDGER_ADD_BUTTON_CLASS,
  LEDGER_CURRENCIES,
  LEDGER_FALLBACK_KRW_RATES,
  LEDGER_INVESTMENT_ASSET_TYPE_OPTIONS,
  LEDGER_INVESTMENT_ASSET_TYPES,
  LEDGER_INVESTMENT_CURRENCY_OPTIONS,
  formatLedgerAmount,
  formatLedgerInvestmentAmount,
  formatLedgerInvestmentSignedAmount,
  formatLedgerSignedAmount,
  getDefaultLedgerInvestmentCurrency,
  getLedgerInvestmentAssetTypeLabel,
  getLedgerProfitColorClass,
  isLedgerInvestmentUsd,
  resolveLedgerInvestmentCurrency,
  toLedgerAmountNumber,
} from '../../constants/ledger.js'
import {
  createInvestment,
  deleteInvestment,
  getInvestments,
  getUsdKrwRate,
  syncInvestmentsFromStockHoldings,
  updateInvestment,
  upsertInvestmentFromStock,
} from '../../services/ledgerService.js'
import { useLedgerInvestmentLiveQuotes } from '../../hooks/useLedgerInvestmentLiveQuotes.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import LedgerAmountInput from './LedgerAmountInput.jsx'

/**
 * 투자 자산 탭 (주식 연동 실시간 평가)
 * @param {{ refreshKey: number, onChanged: () => void }} props
 */
export default function LedgerInvestmentTab({ refreshKey, onChanged }) {
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [assetName, setAssetName] = useState('')
  const [assetType, setAssetType] = useState(LEDGER_INVESTMENT_ASSET_TYPES.DOMESTIC_STOCK)
  const [currency, setCurrency] = useState(LEDGER_CURRENCIES.KRW)
  const [investedAmount, setInvestedAmount] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [usdKrwRate, setUsdKrwRate] = useState(LEDGER_FALLBACK_KRW_RATES.USD)

  const {
    liveInvestments,
    isRefreshing,
    lastUpdatedAt,
    isLiveConnected,
    refreshQuotes,
  } = useLedgerInvestmentLiveQuotes(investments, { usdKrwRate })

  const load = async () => {
    try {
      setLoading(true)
      const [data, rate] = await Promise.all([
        getInvestments(),
        getUsdKrwRate().catch(() => LEDGER_FALLBACK_KRW_RATES.USD),
      ])
      setInvestments(data)
      setUsdKrwRate(rate)
    } catch (error) {
      showToast(error.message || '투자 정보를 불러오지 못했어요.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [refreshKey])

  const toKrw = (item) => {
    const rate = isLedgerInvestmentUsd(item) ? usdKrwRate : 1
    return {
      invested: (Number(item.investedAmount) || 0) * rate,
      value: (Number(item.currentValue) || 0) * rate,
    }
  }

  const totals = useMemo(() => {
    let invested = 0
    let value = 0
    liveInvestments.forEach((item) => {
      const krw = toKrw(item)
      invested += krw.invested
      value += krw.value
    })
    const profit = value - invested
    const profitRate = invested === 0 ? null : (profit / invested) * 100
    return {
      invested: Math.round(invested),
      value: Math.round(value),
      profit: Math.round(profit),
      profitRate: profitRate === null ? null : Math.round(profitRate * 100) / 100,
    }
  }, [liveInvestments, usdKrwRate])

  const isOverseasForm = assetType === LEDGER_INVESTMENT_ASSET_TYPES.OVERSEAS_STOCK
  const isUsdForm = isLedgerInvestmentUsd(currency)

  const clearFormFields = () => {
    setEditing(null)
    setAssetName('')
    setAssetType(LEDGER_INVESTMENT_ASSET_TYPES.DOMESTIC_STOCK)
    setCurrency(LEDGER_CURRENCIES.KRW)
    setInvestedAmount('')
    setCurrentValue('')
  }

  const closeForm = () => {
    setFormOpen(false)
    clearFormFields()
  }

  const openCreate = () => {
    clearFormFields()
    setFormOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setAssetName(item.assetName)
    setAssetType(item.assetType)
    setCurrency(resolveLedgerInvestmentCurrency(item))
    setInvestedAmount(String(item.investedAmount || ''))
    setCurrentValue(String(item.currentValue || ''))
    setFormOpen(true)
  }

  const handleAssetTypeChange = (nextType) => {
    setAssetType(nextType)
    if (nextType === LEDGER_INVESTMENT_ASSET_TYPES.OVERSEAS_STOCK) {
      // 해외주식으로 바꿀 때만 기본 달러 (이미 선택한 통화는 유지하지 않고 기본값)
      setCurrency(getDefaultLedgerInvestmentCurrency(nextType))
    } else {
      setCurrency(LEDGER_CURRENCIES.KRW)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!assetName.trim()) {
      showToast('자산 이름을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    const invested = toLedgerAmountNumber(investedAmount)
    const value = toLedgerAmountNumber(currentValue) || invested
    if (invested <= 0 && value <= 0) {
      showToast('투자원금 또는 평가금액을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    const resolvedCurrency = isOverseasForm
      ? currency
      : LEDGER_CURRENCIES.KRW

    setSaving(true)
    try {
      const payload = {
        assetName: assetName.trim(),
        assetType,
        currency: resolvedCurrency,
        investedAmount: invested,
        currentValue: value,
      }
      if (editing) {
        await updateInvestment(editing.id, {
          ...payload,
          sourceSymbol: editing.sourceSymbol || null,
        })
        // 주식 연동 + 통화 변경 시 보유·시세 기준으로 금액 재계산
        if (
          editing.sourceSymbol &&
          resolveLedgerInvestmentCurrency(editing) !== resolvedCurrency
        ) {
          const { getMyStockWatchlist } = await import(
            '../../services/stockWatchlistService.js'
          )
          const { hasStockHoldings } = await import('../../utils/stockHoldings.js')
          const watchlist = await getMyStockWatchlist()
          const stock = watchlist.find((item) => item.symbol === editing.sourceSymbol)
          if (stock && hasStockHoldings(stock)) {
            await upsertInvestmentFromStock(stock)
          }
        }
        showToast('투자 자산을 수정했어요.', TOAST_TYPES.SUCCESS)
      } else {
        await createInvestment(payload)
        showToast('투자 자산을 추가했어요.', TOAST_TYPES.SUCCESS)
      }
      closeForm()
      await load()
      onChanged()
    } catch (error) {
      showToast(error.message || '저장에 실패했어요.', TOAST_TYPES.ERROR)
    } finally {
      setSaving(false)
    }
  }

  const handleSyncFromStocks = async () => {
    setSyncing(true)
    try {
      const result = await syncInvestmentsFromStockHoldings()
      if (result.synced === 0) {
        showToast(
          '동기화할 주식 보유가 없어요. 주식 탭에서 수량·평단가를 등록해 주세요.',
          TOAST_TYPES.INFO,
        )
      } else {
        showToast(
          `주식 보유 ${result.synced}건을 투자에 반영했어요.`,
          TOAST_TYPES.SUCCESS,
        )
      }
      await load()
      onChanged()
    } catch (error) {
      showToast(error.message || '주식 동기화에 실패했어요.', TOAST_TYPES.ERROR)
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`「${item.assetName}」을(를) 삭제할까요?`)) return
    try {
      await deleteInvestment(item.id)
      showToast('삭제했어요.', TOAST_TYPES.INFO)
      await load()
      onChanged()
    } catch (error) {
      showToast(error.message || '삭제에 실패했어요.', TOAST_TYPES.ERROR)
    }
  }

  if (loading && investments.length === 0) {
    return <p className="text-gray-500 py-8 text-center">불러오는 중…</p>
  }

  const modal =
    formOpen &&
    createPortal(
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
        <form
          onSubmit={handleSubmit}
          className="bg-white w-full sm:max-w-md sm:rounded-lg rounded-t-2xl shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              {editing ? '투자 수정' : '투자 추가'}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="text-2xl text-gray-400 leading-none px-2"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
          {editing?.sourceSymbol && (
            <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
              주식 연동 종목 ({editing.sourceSymbol}). 목록의 평가금액은 실시간 시세로 갱신됩니다.
              {isOverseasForm
                ? ' 기록 통화를 바꾸면 이후 동기화·시세도 해당 통화로 반영됩니다.'
                : ''}
            </p>
          )}
          <div>
            <label className="text-sm text-gray-500">이름</label>
            <input
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 outline-none focus:border-green-500"
              placeholder="예: 삼성전자"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm text-gray-500">종류</label>
            <select
              value={assetType}
              onChange={(e) => handleAssetTypeChange(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 outline-none focus:border-green-500"
            >
              {LEDGER_INVESTMENT_ASSET_TYPE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {isOverseasForm && (
            <div>
              <label className="text-sm text-gray-500">기록 통화</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {LEDGER_INVESTMENT_CURRENCY_OPTIONS.map((opt) => {
                  const selected = currency === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCurrency(opt.id)}
                      className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${
                        selected
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                원으로 기록하면 시세(달러)×환율로 환산해 저장·표시합니다.
              </p>
            </div>
          )}
          <LedgerAmountInput
            label={isUsdForm ? '현재 평가금액 (달러)' : '현재 평가금액'}
            value={currentValue}
            onChange={setCurrentValue}
            placeholder="원금과 같으면 비워도 됩니다"
            showQuickAdd={!isUsdForm}
          />
          <LedgerAmountInput
            label={isUsdForm ? '투자원금 (달러)' : '투자원금'}
            value={investedAmount}
            onChange={setInvestedAmount}
            showQuickAdd={!isUsdForm}
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-semibold"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </form>
      </div>,
      document.body,
    )

  const updatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null

  return (
    <div className="space-y-8 pb-4">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500 mb-1">평가금액</p>
            <p className="text-2xl font-semibold text-gray-900">
              {formatLedgerAmount(totals.value)}
            </p>
            <p className="text-xs text-gray-400 mt-1">달러 기록분은 원화로 환산해 합산</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSyncFromStocks}
              disabled={syncing}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-green-300 bg-white text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              {syncing ? '동기화 중…' : '주식 가져오기'}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className={LEDGER_ADD_BUTTON_CLASS}
            >
              + 추가
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-gray-400">총 투자원금</p>
            <p className="font-semibold text-gray-800">
              {formatLedgerAmount(totals.invested)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">수익</p>
            <p className={`font-semibold ${getLedgerProfitColorClass(totals.profit)}`}>
              {formatLedgerSignedAmount(totals.profit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">수익률</p>
            <p className={`font-semibold ${getLedgerProfitColorClass(totals.profitRate || 0)}`}>
              {totals.profitRate === null
                ? '—'
                : `${totals.profitRate > 0 ? '+' : ''}${totals.profitRate.toFixed(1)}%`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>
            {isLiveConnected ? '실시간 연결' : isRefreshing ? '시세 갱신 중…' : '시세 폴링'}
            {updatedLabel ? ` · ${updatedLabel}` : ''}
          </span>
          <button
            type="button"
            onClick={refreshQuotes}
            disabled={isRefreshing}
            className="text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
          >
            새로고침
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-500 mb-3">투자자산</h3>
        {liveInvestments.length === 0 ? (
          <p className="text-sm text-gray-400">등록된 투자 자산이 없어요.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {liveInvestments.map((item) => {
              const itemCurrency = resolveLedgerInvestmentCurrency(item)
              const isOverseas =
                item.assetType === LEDGER_INVESTMENT_ASSET_TYPES.OVERSEAS_STOCK
              return (
                <li
                  key={item.id}
                  className="py-3 flex items-start justify-between gap-3 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded-lg"
                  onClick={() => openEdit(item)}
                >
                  <div>
                    <p className="font-medium text-gray-800">{item.assetName}</p>
                    <p className="text-xs text-gray-400">
                      {getLedgerInvestmentAssetTypeLabel(item.assetType)}
                      {item.sourceSymbol ? ' · 주식 연동' : ''}
                      {isOverseas
                        ? isLedgerInvestmentUsd(itemCurrency)
                          ? ' · 달러'
                          : ' · 원'
                        : ''}
                      {item.isLiveQuote ? ' · 실시간' : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      원금 {formatLedgerInvestmentAmount(item.investedAmount, item)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">
                      {formatLedgerInvestmentAmount(item.currentValue, item)}
                    </p>
                    <p className={`text-xs ${getLedgerProfitColorClass(item.profit)}`}>
                      {formatLedgerInvestmentSignedAmount(item.profit, item)}
                      {item.profitRate !== null
                        ? ` (${item.profitRate > 0 ? '+' : ''}${item.profitRate.toFixed(1)}%)`
                        : ''}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(item)
                      }}
                      className="text-xs text-gray-300 hover:text-rose-500 mt-1"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {modal}
    </div>
  )
}
