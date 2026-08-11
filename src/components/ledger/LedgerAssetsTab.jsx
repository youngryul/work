import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  LEDGER_ACCOUNT_TYPES,
  LEDGER_ACCOUNT_TYPE_OPTIONS,
  LEDGER_ADD_BUTTON_CLASS,
  LEDGER_CURRENCIES,
  LEDGER_CURRENCY_OPTIONS,
  formatLedgerAmount,
  formatLedgerForeignAmount,
  getLedgerAccountTypeLabel,
  getLedgerCurrencyUnitLabel,
  toLedgerAmountNumber,
} from '../../constants/ledger.js'
import {
  createAccount,
  deleteAccount,
  getNetWorthSummary,
  updateAccount,
} from '../../services/ledgerService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import LedgerAmountInput from './LedgerAmountInput.jsx'

/**
 * 자산/부채/총자산 탭
 * @param {{ refreshKey: number, onChanged: () => void }} props
 */
export default function LedgerAssetsTab({ refreshKey, onChanged }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [type, setType] = useState(LEDGER_ACCOUNT_TYPES.BANK)
  const [currency, setCurrency] = useState(LEDGER_CURRENCIES.KRW)
  const [balance, setBalance] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const data = await getNetWorthSummary()
      setSummary(data)
    } catch (error) {
      showToast(error.message || '자산 정보를 불러오지 못했어요.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [refreshKey])

  const resetForm = () => {
    setFormOpen(false)
    setEditing(null)
    setName('')
    setType(LEDGER_ACCOUNT_TYPES.BANK)
    setCurrency(LEDGER_CURRENCIES.KRW)
    setBalance('')
  }

  const openCreate = () => {
    setEditing(null)
    setName('')
    setType(LEDGER_ACCOUNT_TYPES.BANK)
    setCurrency(LEDGER_CURRENCIES.KRW)
    setBalance('')
    setFormOpen(true)
  }

  const openEdit = (account) => {
    setEditing(account)
    setName(account.name)
    setType(account.type)
    setCurrency(account.currency || LEDGER_CURRENCIES.KRW)
    setBalance(String(Math.abs(account.balance)))
    setFormOpen(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!name.trim()) {
      showToast('계좌 이름을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    const parsed = toLedgerAmountNumber(balance)
    const storedBalance =
      type === LEDGER_ACCOUNT_TYPES.LOAN ? -Math.abs(parsed) : parsed

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        type,
        currency,
        balance: storedBalance,
      }
      if (editing) {
        await updateAccount(editing.id, payload)
        showToast('계좌를 수정했어요.', TOAST_TYPES.SUCCESS)
      } else {
        await createAccount(payload)
        showToast('계좌를 추가했어요.', TOAST_TYPES.SUCCESS)
      }
      resetForm()
      await load()
      onChanged()
    } catch (error) {
      showToast(error.message || '저장에 실패했어요.', TOAST_TYPES.ERROR)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (account) => {
    if (!window.confirm(`「${account.name}」계좌를 삭제할까요?`)) return
    try {
      await deleteAccount(account.id)
      showToast('계좌를 삭제했어요.', TOAST_TYPES.INFO)
      await load()
      onChanged()
    } catch (error) {
      showToast(error.message || '삭제에 실패했어요.', TOAST_TYPES.ERROR)
    }
  }

  if (loading && !summary) {
    return <p className="text-gray-500 py-8 text-center">불러오는 중…</p>
  }

  const assets = (summary?.accounts || []).filter(
    (a) =>
      a.type !== LEDGER_ACCOUNT_TYPES.LOAN &&
      a.type !== LEDGER_ACCOUNT_TYPES.CARD &&
      a.type !== LEDGER_ACCOUNT_TYPES.INVESTMENT,
  )
  const loans = (summary?.accounts || []).filter(
    (a) => a.type === LEDGER_ACCOUNT_TYPES.LOAN,
  )

  const renderBalance = (account) => {
    const isForeign = account.currency && account.currency !== LEDGER_CURRENCIES.KRW
    if (!isForeign) {
      return (
        <p className="font-semibold text-gray-800">
          {formatLedgerAmount(Math.abs(account.balance))}
        </p>
      )
    }
    return (
      <div className="text-right">
        <p className="font-semibold text-gray-800">
          {formatLedgerForeignAmount(account.balance, account.currency)}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {formatLedgerAmount(Math.abs(account.balanceKrw ?? 0))}
        </p>
      </div>
    )
  }

  const cashAccounts = assets.filter((a) => a.type === LEDGER_ACCOUNT_TYPES.CASH)
  const bankAccounts = assets.filter((a) => a.type === LEDGER_ACCOUNT_TYPES.BANK)

  const renderAccountItem = (account) => (
    <li
      key={account.id}
      className="py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded-lg"
      onClick={() => openEdit(account)}
    >
      <div>
        <p className="font-medium text-gray-800">{account.name}</p>
        <p className="text-xs text-gray-400">
          {getLedgerAccountTypeLabel(account.type)}
          {account.currency && account.currency !== LEDGER_CURRENCIES.KRW
            ? ` · ${getLedgerCurrencyUnitLabel(account.currency)}`
            : ''}
        </p>
      </div>
      <div className="text-right">
        {renderBalance(account)}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleDelete(account)
          }}
          className="text-xs text-gray-300 hover:text-rose-500"
        >
          삭제
        </button>
      </div>
    </li>
  )

  const renderAccountSection = (title, list, emptyText) => (
    <section>
      <h3 className="text-sm font-semibold text-gray-500 mb-3">{title}</h3>
      {list.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-gray-100">{list.map(renderAccountItem)}</ul>
      )}
    </section>
  )

  return (
    <div className="space-y-8 pb-4">
      <section>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-gray-500 mb-1">총자산</p>
            <p className="text-3xl font-semibold text-gray-900">
              {formatLedgerAmount(summary?.netWorth || 0)}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              부채를 제외한 자산 합계 (외화는 원화 환산)
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className={LEDGER_ADD_BUTTON_CLASS}
          >
            + 추가
          </button>
        </div>
      </section>

      {renderAccountSection('현금', cashAccounts, '등록된 현금이 없어요.')}
      {renderAccountSection('적금', bankAccounts, '등록된 적금이 없어요.')}

      <section>
        <h3 className="text-sm font-semibold text-gray-500 mb-3">부채</h3>
        {loans.length === 0 ? (
          <p className="text-sm text-gray-400">등록된 부채가 없어요.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {loans.map(renderAccountItem)}
          </ul>
        )}
      </section>

      {formOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
            <form
              onSubmit={handleSubmit}
              className="bg-white w-full sm:max-w-md sm:rounded-lg rounded-t-2xl shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">
                  {editing ? '수정' : '추가'}
                </h2>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-2xl text-gray-400 leading-none px-2"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
              <div>
                <label className="text-sm text-gray-500">이름</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 outline-none focus:border-green-500"
                  placeholder="예: 달러 현금"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-gray-500">유형</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 outline-none focus:border-green-500"
                >
                  {LEDGER_ACCOUNT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500">통화</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 outline-none focus:border-green-500"
                >
                  {LEDGER_CURRENCY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <LedgerAmountInput
                label={
                  type === LEDGER_ACCOUNT_TYPES.LOAN
                    ? `대출 잔액 (${getLedgerCurrencyUnitLabel(currency)})`
                    : `잔액 (${getLedgerCurrencyUnitLabel(currency)})`
                }
                value={balance}
                onChange={setBalance}
                showQuickAdd={currency === LEDGER_CURRENCIES.KRW}
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
        )}
    </div>
  )
}
