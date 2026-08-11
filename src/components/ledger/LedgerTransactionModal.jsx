import { useEffect, useState } from 'react'
import {
  LEDGER_CATEGORY_TYPES,
  LEDGER_TRANSACTION_TYPES,
  LEDGER_TRANSACTION_TYPE_OPTIONS,
  toLedgerAmountNumber,
} from '../../constants/ledger.js'
import { toDateString } from '../../utils/ledgerPeriod.js'
import {
  createTransaction,
  updateTransaction,
} from '../../services/ledgerService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import LedgerAmountInput from './LedgerAmountInput.jsx'

/**
 * 거래 추가/수정 모달
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSaved: () => void,
 *   categories: Object[],
 *   accounts: Object[],
 *   initialType?: string|null,
 *   editingTransaction?: Object|null
 * }} props
 */
export default function LedgerTransactionModal({
  isOpen,
  onClose,
  onSaved,
  categories,
  accounts,
  initialType = null,
  editingTransaction = null,
}) {
  const [step, setStep] = useState('type') // type | form
  const [type, setType] = useState(LEDGER_TRANSACTION_TYPES.EXPENSE)
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [transactionDate, setTransactionDate] = useState(toDateString(new Date()))
  const [memo, setMemo] = useState('')
  const [fixedCostYn, setFixedCostYn] = useState(false)
  const [saving, setSaving] = useState(false)

  const isEdit = Boolean(editingTransaction)

  useEffect(() => {
    if (!isOpen) return

    if (editingTransaction) {
      setStep('form')
      setType(editingTransaction.type)
      setAmount(String(editingTransaction.amount || ''))
      setCategoryId(editingTransaction.categoryId || '')
      setAccountId(editingTransaction.accountId || '')
      setToAccountId(editingTransaction.toAccountId || '')
      setPaymentMethod(editingTransaction.paymentMethod || '')
      setTransactionDate(editingTransaction.transactionDate || toDateString(new Date()))
      setMemo(editingTransaction.memo || '')
      setFixedCostYn(Boolean(editingTransaction.fixedCostYn))
      return
    }

    if (initialType) {
      setStep('form')
      setType(initialType)
    } else {
      setStep('type')
      setType(LEDGER_TRANSACTION_TYPES.EXPENSE)
    }
    setAmount('')
    setCategoryId('')
    setAccountId('')
    setToAccountId('')
    setPaymentMethod('')
    setTransactionDate(toDateString(new Date()))
    setMemo('')
    setFixedCostYn(false)
  }, [isOpen, initialType, editingTransaction])

  if (!isOpen) return null

  const categoryType =
    type === LEDGER_TRANSACTION_TYPES.INCOME
      ? LEDGER_CATEGORY_TYPES.INCOME
      : LEDGER_CATEGORY_TYPES.EXPENSE

  const filteredCategories = categories.filter((c) => c.type === categoryType)
  const needsCategory =
    type === LEDGER_TRANSACTION_TYPES.EXPENSE ||
    type === LEDGER_TRANSACTION_TYPES.INCOME
  const isTransfer = type === LEDGER_TRANSACTION_TYPES.TRANSFER

  const handleSelectType = (nextType) => {
    setType(nextType)
    setCategoryId('')
    setFixedCostYn(false)
    setStep('form')
  }

  const handleCategoryChange = (id) => {
    setCategoryId(id)
    const category = categories.find((c) => c.id === id)
    if (category && type === LEDGER_TRANSACTION_TYPES.EXPENSE) {
      setFixedCostYn(Boolean(category.fixedCostYn))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const parsedAmount = toLedgerAmountNumber(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      showToast('금액을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (needsCategory && !categoryId) {
      showToast('카테고리를 선택해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (isTransfer && (!accountId || !toAccountId)) {
      showToast('출금/입금 계좌를 선택해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (isTransfer && accountId === toAccountId) {
      showToast('출금과 입금 계좌가 달라야 해요.', TOAST_TYPES.ERROR)
      return
    }

    setSaving(true)
    try {
      const payload = {
        type,
        amount: parsedAmount,
        categoryId: needsCategory ? categoryId : null,
        accountId: accountId || null,
        toAccountId: isTransfer ? toAccountId : null,
        paymentMethod: paymentMethod.trim() || null,
        transactionDate,
        memo: memo.trim() || null,
        fixedCostYn: type === LEDGER_TRANSACTION_TYPES.EXPENSE ? fixedCostYn : false,
      }

      if (isEdit) {
        await updateTransaction(editingTransaction.id, payload)
        showToast('거래를 수정했어요.', TOAST_TYPES.SUCCESS)
      } else {
        await createTransaction(payload)
        showToast('거래를 저장했어요.', TOAST_TYPES.SUCCESS)
      }
      onSaved()
      onClose()
    } catch (error) {
      showToast(error.message || '저장에 실패했어요.', TOAST_TYPES.ERROR)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-lg rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">
            {step === 'type' ? '거래 추가' : isEdit ? '거래 수정' : '거래 입력'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {step === 'type' && (
          <div className="p-5 grid grid-cols-2 gap-3">
            {LEDGER_TRANSACTION_TYPE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelectType(option.id)}
                className="py-6 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 text-lg font-semibold text-gray-700 transition-colors"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {!isEdit && (
              <button
                type="button"
                onClick={() => setStep('type')}
                className="text-sm text-green-600 hover:text-green-700"
              >
                ← 유형 다시 선택
              </button>
            )}

            <div>
              <label className="block text-sm text-gray-500 mb-1">유형</label>
              <p className="text-base font-semibold text-gray-800">
                {LEDGER_TRANSACTION_TYPE_OPTIONS.find((o) => o.id === type)?.label}
              </p>
            </div>

            <LedgerAmountInput
              label="금액"
              required
              value={amount}
              onChange={setAmount}
              autoFocus
              inputClassName="w-full text-3xl font-semibold border-b-2 border-gray-200 focus:border-green-500 outline-none py-2"
            />

            {needsCategory && (
              <div>
                <label className="block text-sm text-gray-500 mb-1">카테고리 *</label>
                <div className="flex flex-wrap gap-2">
                  {filteredCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleCategoryChange(category.id)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        categoryId === category.id
                          ? 'bg-green-500 text-white border-green-500'
                          : 'border-gray-200 text-gray-600 hover:border-green-300'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-500 mb-1">날짜 *</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-500"
              />
            </div>

            {isTransfer ? (
              <>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">출금 계좌 *</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-500"
                  >
                    <option value="">선택</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">입금 계좌 *</label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-500"
                  >
                    <option value="">선택</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm text-gray-500 mb-1">계좌</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-500"
                >
                  <option value="">선택 안 함</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isTransfer && type !== LEDGER_TRANSACTION_TYPES.INVESTMENT && (
              <div>
                <label className="block text-sm text-gray-500 mb-1">결제수단</label>
                <input
                  type="text"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  placeholder="예: 국민카드"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-500 mb-1">메모</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="선택 입력"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-green-500"
              />
            </div>

            {type === LEDGER_TRANSACTION_TYPES.EXPENSE && (
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={fixedCostYn}
                  onChange={(e) => setFixedCostYn(e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                고정비로 분류
              </label>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-semibold transition-colors"
            >
              {saving ? '저장 중…' : isEdit ? '수정하기' : '빠르게 저장'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
