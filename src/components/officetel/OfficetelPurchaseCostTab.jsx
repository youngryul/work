import { useState, useEffect } from 'react'
import {
  getOfficetelPurchasePayers,
  saveOfficetelPurchasePayer,
  updateOfficetelPurchasePayer,
  deleteOfficetelPurchasePayer,
  getOfficetelPurchaseCosts,
  saveOfficetelPurchaseCost,
  updateOfficetelPurchaseCost,
  deleteOfficetelPurchaseCost,
} from '../../services/officetelPurchaseService.js'
import LedgerAmountInput from '../ledger/LedgerAmountInput.jsx'
import { toLedgerAmountNumber } from '../../constants/ledger.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

const COST_CATEGORY_SUGGESTIONS = ['중개수수료(복비)', '법무사비', '취득세', '등기비용', '이사비', '기타']

const EMPTY_PAYER_FORM = { payer_name: '', amount: '', memo: '' }
const EMPTY_COST_FORM = { category: '', amount: '', memo: '' }

/**
 * 오피스텔 매물 상세 - 분담 내역 + 기타 비용 관리
 * @param {{ purchase: Object, onTotalsChange?: () => void }} props
 */
export default function OfficetelPurchaseCostTab({ purchase, onTotalsChange }) {
  const [payers, setPayers] = useState([])
  const [costs, setCosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [payerForm, setPayerForm] = useState(EMPTY_PAYER_FORM)
  const [editingPayerId, setEditingPayerId] = useState(null)
  const [costForm, setCostForm] = useState(EMPTY_COST_FORM)
  const [editingCostId, setEditingCostId] = useState(null)

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase.id])

  const loadAll = async () => {
    try {
      setLoading(true)
      const [payerData, costData] = await Promise.all([
        getOfficetelPurchasePayers(purchase.id),
        getOfficetelPurchaseCosts(purchase.id),
      ])
      setPayers(payerData)
      setCosts(costData)
    } catch (error) {
      console.error('상세 내역 로드 실패:', error)
      showToast('상세 내역을 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  const resetPayerForm = () => {
    setPayerForm(EMPTY_PAYER_FORM)
    setEditingPayerId(null)
  }

  const resetCostForm = () => {
    setCostForm(EMPTY_COST_FORM)
    setEditingCostId(null)
  }

  const handleSavePayer = async (e) => {
    e.preventDefault()
    if (!payerForm.payer_name.trim()) {
      showToast('낸 사람 이름을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    const amount = toLedgerAmountNumber(payerForm.amount)
    if (amount <= 0) {
      showToast('금액을 올바르게 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      const dataToSave = {
        payer_name: payerForm.payer_name.trim(),
        amount,
        memo: payerForm.memo || null,
      }
      if (editingPayerId) {
        await updateOfficetelPurchasePayer(editingPayerId, dataToSave)
        showToast('분담 내역이 수정되었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await saveOfficetelPurchasePayer(purchase.id, dataToSave)
        showToast('분담 내역이 추가되었습니다.', TOAST_TYPES.SUCCESS)
      }
      resetPayerForm()
      await loadAll()
      onTotalsChange?.()
    } catch (error) {
      console.error('분담 내역 저장 실패:', error)
      showToast('분담 내역 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleEditPayer = (payer) => {
    setEditingPayerId(payer.id)
    setPayerForm({
      payer_name: payer.payer_name,
      amount: String(payer.amount),
      memo: payer.memo || '',
    })
  }

  const handleDeletePayer = async (payerId) => {
    if (!window.confirm('이 분담 내역을 삭제하시겠습니까?')) return
    try {
      await deleteOfficetelPurchasePayer(payerId)
      showToast('분담 내역이 삭제되었습니다.', TOAST_TYPES.SUCCESS)
      await loadAll()
      onTotalsChange?.()
    } catch (error) {
      console.error('분담 내역 삭제 실패:', error)
      showToast('분담 내역 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleSaveCost = async (e) => {
    e.preventDefault()
    if (!costForm.category.trim()) {
      showToast('비용 항목을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    const amount = toLedgerAmountNumber(costForm.amount)
    if (amount <= 0) {
      showToast('금액을 올바르게 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      const dataToSave = {
        category: costForm.category.trim(),
        amount,
        memo: costForm.memo || null,
      }
      if (editingCostId) {
        await updateOfficetelPurchaseCost(editingCostId, dataToSave)
        showToast('비용 항목이 수정되었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await saveOfficetelPurchaseCost(purchase.id, dataToSave)
        showToast('비용 항목이 추가되었습니다.', TOAST_TYPES.SUCCESS)
      }
      resetCostForm()
      await loadAll()
      onTotalsChange?.()
    } catch (error) {
      console.error('비용 항목 저장 실패:', error)
      showToast('비용 항목 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleEditCost = (cost) => {
    setEditingCostId(cost.id)
    setCostForm({
      category: cost.category,
      amount: String(cost.amount),
      memo: cost.memo || '',
    })
  }

  const handleDeleteCost = async (costId) => {
    if (!window.confirm('이 비용 항목을 삭제하시겠습니까?')) return
    try {
      await deleteOfficetelPurchaseCost(costId)
      showToast('비용 항목이 삭제되었습니다.', TOAST_TYPES.SUCCESS)
      await loadAll()
      onTotalsChange?.()
    } catch (error) {
      console.error('비용 항목 삭제 실패:', error)
      showToast('비용 항목 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  if (loading) {
    return <div className="py-6 text-center text-sm text-gray-500 font-sans">불러오는 중...</div>
  }

  return (
    <div className="space-y-6 pt-2">
      {/* 분담 내역 */}
      <div>
        <h3 className="text-lg font-handwriting text-gray-800 mb-2">분담 내역 (누가 얼마 냈는지)</h3>
        <form onSubmit={handleSavePayer} className="flex flex-wrap items-end gap-2 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-gray-500 mb-1 font-sans">이름</label>
            <input
              type="text"
              value={payerForm.payer_name}
              onChange={(e) => setPayerForm({ ...payerForm, payer_name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans"
              placeholder="예: 나"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <LedgerAmountInput
              label="금액"
              value={payerForm.amount}
              onChange={(digits) => setPayerForm({ ...payerForm, amount: digits })}
              showQuickAdd={false}
              inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-gray-500 mb-1 font-sans">메모</label>
            <input
              type="text"
              value={payerForm.memo}
              onChange={(e) => setPayerForm({ ...payerForm, memo: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans"
              placeholder="선택 입력"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium font-sans">
              {editingPayerId ? '수정' : '추가'}
            </button>
            {editingPayerId && (
              <button type="button" onClick={resetPayerForm} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-sans">
                취소
              </button>
            )}
          </div>
        </form>

        {payers.length === 0 ? (
          <p className="text-sm text-gray-400 font-sans">등록된 분담 내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {payers.map((payer) => (
              <div key={payer.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                <div className="font-sans text-sm">
                  <span className="font-semibold text-gray-800">{payer.payer_name}</span>
                  <span className="ml-3 font-bold text-amber-600">{Number(payer.amount).toLocaleString()}원</span>
                  {payer.memo && <span className="ml-3 text-gray-500">{payer.memo}</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditPayer(payer)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-sans hover:bg-blue-200">수정</button>
                  <button onClick={() => handleDeletePayer(payer.id)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-sans hover:bg-red-200">삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 기타 비용 */}
      <div>
        <h3 className="text-lg font-handwriting text-gray-800 mb-2">기타 비용 (복비, 법무사비 등)</h3>
        <form onSubmit={handleSaveCost} className="flex flex-wrap items-end gap-2 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-gray-500 mb-1 font-sans">항목</label>
            <input
              type="text"
              list="officetel-cost-category-suggestions"
              value={costForm.category}
              onChange={(e) => setCostForm({ ...costForm, category: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans"
              placeholder="예: 중개수수료(복비)"
            />
            <datalist id="officetel-cost-category-suggestions">
              {COST_CATEGORY_SUGGESTIONS.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </div>
          <div className="flex-1 min-w-[140px]">
            <LedgerAmountInput
              label="금액"
              value={costForm.amount}
              onChange={(digits) => setCostForm({ ...costForm, amount: digits })}
              showQuickAdd={false}
              inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-gray-500 mb-1 font-sans">메모</label>
            <input
              type="text"
              value={costForm.memo}
              onChange={(e) => setCostForm({ ...costForm, memo: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans"
              placeholder="선택 입력"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium font-sans">
              {editingCostId ? '수정' : '추가'}
            </button>
            {editingCostId && (
              <button type="button" onClick={resetCostForm} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-sans">
                취소
              </button>
            )}
          </div>
        </form>

        {costs.length === 0 ? (
          <p className="text-sm text-gray-400 font-sans">등록된 기타 비용이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {costs.map((cost) => (
              <div key={cost.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                <div className="font-sans text-sm">
                  <span className="font-semibold text-gray-800">
                    {cost.category === '기타' && cost.memo ? cost.memo : cost.category}
                  </span>
                  <span className="ml-3 font-bold text-amber-600">{Number(cost.amount).toLocaleString()}원</span>
                  {cost.memo && cost.category !== '기타' && <span className="ml-3 text-gray-500">{cost.memo}</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditCost(cost)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-sans hover:bg-blue-200">수정</button>
                  <button onClick={() => handleDeleteCost(cost.id)} className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-sans hover:bg-red-200">삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
