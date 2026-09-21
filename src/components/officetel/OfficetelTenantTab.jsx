import { useState, useEffect } from 'react'
import { format, eachMonthOfInterval, parseISO, startOfMonth } from 'date-fns'
import {
  getOfficetelTenants,
  saveOfficetelTenant,
  updateOfficetelTenant,
  deleteOfficetelTenant,
  getOfficetelTenantRentPaymentsMap,
  markOfficetelTenantRentPaid,
  unmarkOfficetelTenantRentPaid,
  getOfficetelTenantDepositSharesMap,
  saveOfficetelTenantDepositShare,
  updateOfficetelTenantDepositShare,
  deleteOfficetelTenantDepositShare,
} from '../../services/officetelTenantService.js'
import { getOfficetelPurchasePayers } from '../../services/officetelPurchaseService.js'
import LedgerAmountInput from '../ledger/LedgerAmountInput.jsx'
import { toLedgerAmountNumber } from '../../constants/ledger.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

const EMPTY_TENANT_FORM = {
  tenant_name: '',
  contract_start_date: format(new Date(), 'yyyy-MM-dd'),
  contract_end_date: format(new Date(), 'yyyy-MM-dd'),
  deposit: '',
  monthly_rent: '',
  memo: '',
}

const EMPTY_SHARE_FORM = { holder_name: '', amount: '', memo: '' }

/**
 * 계약기간(YYYY-MM-DD ~ YYYY-MM-DD) 내 월 목록 ('YYYY-MM')
 * @param {string} startDate
 * @param {string} endDate
 * @returns {string[]}
 */
function getContractMonths(startDate, endDate) {
  if (!startDate || !endDate) return []
  const start = startOfMonth(parseISO(startDate))
  const end = startOfMonth(parseISO(endDate))
  if (start > end) return []
  return eachMonthOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM'))
}

/**
 * 오피스텔 임차인 관리 탭 - 임차인 정보 + 월별 월세 수령 체크
 * @param {{ purchaseId: string }} props
 */
export default function OfficetelTenantTab({ purchaseId }) {
  const [tenants, setTenants] = useState([])
  const [paidMonthsMap, setPaidMonthsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTenant, setEditingTenant] = useState(null)
  const [formData, setFormData] = useState(EMPTY_TENANT_FORM)
  const [sharesMap, setSharesMap] = useState({}) // tenantId -> 보증금 수령 내역[]
  const [holderSuggestions, setHolderSuggestions] = useState([]) // 매매 분담자 이름 (입력 추천)
  const [shareTenantId, setShareTenantId] = useState(null) // 보증금 수령 폼이 열린 임차인
  const [editingShareId, setEditingShareId] = useState(null)
  const [shareForm, setShareForm] = useState(EMPTY_SHARE_FORM)

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId])

  const loadAll = async () => {
    try {
      setLoading(true)
      const tenantData = await getOfficetelTenants(purchaseId)
      setTenants(tenantData)
      const paymentsMap = await getOfficetelTenantRentPaymentsMap(tenantData.map((t) => t.id))
      setPaidMonthsMap(paymentsMap)
      setSharesMap(await getOfficetelTenantDepositSharesMap(tenantData.map((t) => t.id)))
      // 분담자 이름은 입력 편의용이므로 실패해도 무시
      getOfficetelPurchasePayers(purchaseId)
        .then((payers) => setHolderSuggestions([...new Set(payers.map((p) => p.payer_name))]))
        .catch(() => {})
    } catch (error) {
      console.error('임차인 목록 로드 실패:', error)
      showToast('임차인 목록을 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData(EMPTY_TENANT_FORM)
    setEditingTenant(null)
    setShowForm(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.tenant_name.trim()) {
      showToast('임차인 이름을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (!formData.contract_start_date || !formData.contract_end_date) {
      showToast('계약기간을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (formData.contract_start_date > formData.contract_end_date) {
      showToast('계약 종료일은 시작일보다 이후여야 합니다.', TOAST_TYPES.ERROR)
      return
    }

    try {
      const dataToSave = {
        tenant_name: formData.tenant_name.trim(),
        contract_start_date: formData.contract_start_date,
        contract_end_date: formData.contract_end_date,
        deposit: toLedgerAmountNumber(formData.deposit),
        monthly_rent: toLedgerAmountNumber(formData.monthly_rent),
        memo: formData.memo || null,
      }

      if (editingTenant) {
        await updateOfficetelTenant(editingTenant.id, dataToSave)
        showToast('임차인 정보가 수정되었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await saveOfficetelTenant(purchaseId, dataToSave)
        showToast('임차인이 추가되었습니다.', TOAST_TYPES.SUCCESS)
      }

      resetForm()
      await loadAll()
    } catch (error) {
      console.error('임차인 저장 실패:', error)
      showToast('임차인 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleEdit = (tenant) => {
    setEditingTenant(tenant)
    setFormData({
      tenant_name: tenant.tenant_name,
      contract_start_date: tenant.contract_start_date,
      contract_end_date: tenant.contract_end_date,
      deposit: String(tenant.deposit),
      monthly_rent: String(tenant.monthly_rent),
      memo: tenant.memo || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (tenantId) => {
    if (!window.confirm('이 임차인 기록을 삭제하시겠습니까? 월세 수령 체크 내역도 함께 삭제됩니다.')) return
    try {
      await deleteOfficetelTenant(tenantId)
      showToast('임차인 기록이 삭제되었습니다.', TOAST_TYPES.SUCCESS)
      await loadAll()
    } catch (error) {
      console.error('임차인 삭제 실패:', error)
      showToast('임차인 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const resetShareForm = () => {
    setShareForm(EMPTY_SHARE_FORM)
    setEditingShareId(null)
    setShareTenantId(null)
  }

  const handleOpenShareForm = (tenantId) => {
    setShareForm(EMPTY_SHARE_FORM)
    setEditingShareId(null)
    setShareTenantId(tenantId)
  }

  const handleEditShare = (tenantId, share) => {
    setShareTenantId(tenantId)
    setEditingShareId(share.id)
    setShareForm({
      holder_name: share.holder_name,
      amount: String(share.amount),
      memo: share.memo || '',
    })
  }

  const handleSaveShare = async (e) => {
    e.preventDefault()
    if (!shareForm.holder_name.trim()) {
      showToast('가져간 사람 이름을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    const amount = toLedgerAmountNumber(shareForm.amount)
    if (amount <= 0) {
      showToast('금액을 올바르게 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      const dataToSave = {
        holder_name: shareForm.holder_name.trim(),
        amount,
        memo: shareForm.memo || null,
      }
      if (editingShareId) {
        await updateOfficetelTenantDepositShare(editingShareId, dataToSave)
        showToast('보증금 수령 내역이 수정되었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await saveOfficetelTenantDepositShare(shareTenantId, dataToSave)
        showToast('보증금 수령 내역이 추가되었습니다.', TOAST_TYPES.SUCCESS)
      }
      resetShareForm()
      await loadAll()
    } catch (error) {
      console.error('보증금 수령 내역 저장 실패:', error)
      showToast('보증금 수령 내역 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleDeleteShare = async (shareId) => {
    if (!window.confirm('이 보증금 수령 내역을 삭제하시겠습니까?')) return
    try {
      await deleteOfficetelTenantDepositShare(shareId)
      showToast('보증금 수령 내역이 삭제되었습니다.', TOAST_TYPES.SUCCESS)
      await loadAll()
    } catch (error) {
      console.error('보증금 수령 내역 삭제 실패:', error)
      showToast('보증금 수령 내역 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleToggleMonth = async (tenant, month) => {
    const paidMonths = paidMonthsMap[tenant.id] || []
    const isPaid = paidMonths.includes(month)

    // 낙관적 업데이트
    setPaidMonthsMap((prev) => ({
      ...prev,
      [tenant.id]: isPaid
        ? (prev[tenant.id] || []).filter((m) => m !== month)
        : [...(prev[tenant.id] || []), month],
    }))

    try {
      if (isPaid) {
        await unmarkOfficetelTenantRentPaid(tenant.id, month)
      } else {
        await markOfficetelTenantRentPaid(tenant.id, month)
      }
    } catch (error) {
      console.error('월세 수령 체크 실패:', error)
      showToast('월세 수령 체크에 실패했습니다.', TOAST_TYPES.ERROR)
      // 롤백
      setPaidMonthsMap((prev) => ({
        ...prev,
        [tenant.id]: isPaid
          ? [...(prev[tenant.id] || []), month]
          : (prev[tenant.id] || []).filter((m) => m !== month),
      }))
    }
  }

  if (loading) {
    return <div className="py-6 text-center text-sm text-gray-500 font-sans">불러오는 중...</div>
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-handwriting text-gray-800">임차인 관리</h3>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium font-sans"
        >
          + 임차인 추가
        </button>
      </div>

      {/* 폼 */}
      {showForm && (
        <form onSubmit={handleSave} className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-sans">임차인 이름 *</label>
              <input
                type="text"
                value={formData.tenant_name}
                onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans"
                placeholder="예: 홍길동"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-sans">계약 시작일 *</label>
                <input
                  type="date"
                  value={formData.contract_start_date}
                  onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-sans">계약 종료일 *</label>
                <input
                  type="date"
                  value={formData.contract_end_date}
                  onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans"
                />
              </div>
            </div>
            <LedgerAmountInput
              label="보증금"
              value={formData.deposit}
              onChange={(digits) => setFormData({ ...formData, deposit: digits })}
              showQuickAdd={false}
              inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans"
            />
            <LedgerAmountInput
              label="월세"
              value={formData.monthly_rent}
              onChange={(digits) => setFormData({ ...formData, monthly_rent: digits })}
              showQuickAdd={false}
              inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-sans">메모</label>
            <input
              type="text"
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans"
              placeholder="선택 입력"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-sans font-medium shadow-md text-sm">
              {editingTenant ? '수정' : '저장'}
            </button>
            <button type="button" onClick={resetForm} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-sans font-medium text-sm">
              취소
            </button>
          </div>
        </form>
      )}

      {/* 임차인 목록 */}
      {tenants.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-sm text-gray-500 font-sans">등록된 임차인이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tenants.map((tenant) => {
            const months = getContractMonths(tenant.contract_start_date, tenant.contract_end_date)
            const paidMonths = paidMonthsMap[tenant.id] || []
            const paidCount = months.filter((m) => paidMonths.includes(m)).length
            const monthlyRent = Number(tenant.monthly_rent)
            const shares = sharesMap[tenant.id] || []
            const sharedTotal = shares.reduce((sum, share) => sum + Number(share.amount), 0)
            const depositRemaining = Number(tenant.deposit) - sharedTotal

            return (
              <div key={tenant.id} className="p-4 bg-white rounded-lg border border-gray-200 space-y-3">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-lg font-sans font-bold text-gray-800">{tenant.tenant_name}</span>
                      <span className="text-sm text-gray-500 font-sans">
                        {tenant.contract_start_date} ~ {tenant.contract_end_date}
                      </span>
                    </div>
                    <div className="text-sm font-sans text-gray-700 flex flex-wrap gap-x-4 mt-1">
                      <span>보증금 <b className="text-gray-800">{Number(tenant.deposit).toLocaleString()}원</b></span>
                      <span>월세 <b className="text-gray-800">{monthlyRent.toLocaleString()}원</b></span>
                      <span>
                        수령 <b className={paidCount === months.length ? 'text-green-600' : 'text-amber-600'}>{paidCount}/{months.length}개월</b>
                      </span>
                      <span>수령액 <b className="text-amber-700">{(paidCount * monthlyRent).toLocaleString()}원</b></span>
                    </div>
                    {tenant.memo && <div className="text-sm text-gray-500 font-sans mt-1">{tenant.memo}</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleEdit(tenant)} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-sans text-sm">수정</button>
                    <button onClick={() => handleDelete(tenant.id)} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-sans text-sm">삭제</button>
                  </div>
                </div>

                {/* 보증금 수령 내역 (누가 얼마 가져갔는지) */}
                <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-100 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm font-sans font-semibold text-gray-700">
                      보증금 수령 내역
                      <span className="ml-2 font-normal text-gray-600">
                        합계 <b className="text-gray-800">{sharedTotal.toLocaleString()}원</b>
                        {' / '}
                        {depositRemaining === 0 ? (
                          <b className="text-green-600">전액 배분됨</b>
                        ) : depositRemaining > 0 ? (
                          <>남은 금액 <b className="text-amber-700">{depositRemaining.toLocaleString()}원</b></>
                        ) : (
                          <b className="text-red-600">보증금보다 {Math.abs(depositRemaining).toLocaleString()}원 초과</b>
                        )}
                      </span>
                    </div>
                    {shareTenantId !== tenant.id && (
                      <button
                        type="button"
                        onClick={() => handleOpenShareForm(tenant.id)}
                        className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-sans text-xs font-medium"
                      >
                        + 수령 내역 추가
                      </button>
                    )}
                  </div>

                  {shares.length > 0 && (
                    <ul className="space-y-1">
                      {shares.map((share) => (
                        <li key={share.id} className="flex items-center justify-between gap-2 text-sm font-sans">
                          <span className="min-w-0 break-all">
                            <span className="font-semibold text-gray-800">{share.holder_name}</span>
                            <span className="ml-2 text-gray-700">{Number(share.amount).toLocaleString()}원</span>
                            {share.memo && <span className="ml-2 text-gray-500">{share.memo}</span>}
                          </span>
                          <span className="flex gap-1 shrink-0">
                            <button type="button" onClick={() => handleEditShare(tenant.id, share)} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-xs">수정</button>
                            <button type="button" onClick={() => handleDeleteShare(share.id)} className="px-2 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-xs">삭제</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {shareTenantId === tenant.id && (
                    <form onSubmit={handleSaveShare} className="space-y-2 pt-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1 font-sans">가져간 사람 *</label>
                          <input
                            type="text"
                            list={`deposit-holders-${tenant.id}`}
                            value={shareForm.holder_name}
                            onChange={(e) => setShareForm({ ...shareForm, holder_name: e.target.value })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans bg-white"
                            placeholder="예: 홍길동"
                          />
                          <datalist id={`deposit-holders-${tenant.id}`}>
                            {holderSuggestions.map((name) => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                        </div>
                        <LedgerAmountInput
                          label="금액 *"
                          value={shareForm.amount}
                          onChange={(digits) => setShareForm({ ...shareForm, amount: digits })}
                          showQuickAdd={false}
                          inputClassName="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans bg-white"
                        />
                      </div>
                      <input
                        type="text"
                        value={shareForm.memo}
                        onChange={(e) => setShareForm({ ...shareForm, memo: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-500 text-sm font-sans bg-white"
                        placeholder="메모 (선택 입력)"
                      />
                      <div className="flex gap-2">
                        <button type="submit" className="px-4 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-sans font-medium text-sm">
                          {editingShareId ? '수정' : '저장'}
                        </button>
                        <button type="button" onClick={resetShareForm} className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-sans font-medium text-sm">
                          취소
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* 월별 월세 수령 체크 */}
                <div className="flex flex-wrap gap-2">
                  {months.map((month) => {
                    const isPaid = paidMonths.includes(month)
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => handleToggleMonth(tenant, month)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium border transition-colors ${
                          isPaid
                            ? 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {isPaid ? '✓ ' : ''}{month}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
