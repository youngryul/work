import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  getOfficetelPurchaseRecords,
  saveOfficetelPurchaseRecord,
  updateOfficetelPurchaseRecord,
  deleteOfficetelPurchaseRecord,
  getOfficetelPurchaseTotals,
} from '../../services/officetelPurchaseService.js'
import LedgerAmountInput from '../ledger/LedgerAmountInput.jsx'
import { toLedgerAmountNumber } from '../../constants/ledger.js'
import OfficetelPurchaseDetail from './OfficetelPurchaseDetail.jsx'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

const EMPTY_FORM = {
  property_name: '',
  address: '',
  purchase_date: format(new Date(), 'yyyy-MM-dd'),
  sale_price: '',
  memo: '',
}

/**
 * 오피스텔 매매 기록 메인 뷰
 * 매물별 매매가, 분담 내역(누가 얼마 냈는지), 기타 비용(복비/법무사비 등)을 관리
 */
export default function OfficetelPurchaseView() {
  const [records, setRecords] = useState([])
  const [totals, setTotals] = useState({ payerTotals: {}, costTotals: {} })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      setLoading(true)
      const [recordData, totalsData] = await Promise.all([
        getOfficetelPurchaseRecords(),
        getOfficetelPurchaseTotals(),
      ])
      setRecords(recordData)
      setTotals(totalsData)
    } catch (error) {
      console.error('오피스텔 매매 기록 로드 실패:', error)
      showToast('기록을 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  const loadTotals = async () => {
    try {
      setTotals(await getOfficetelPurchaseTotals())
    } catch (error) {
      console.error('합계 로드 실패:', error)
    }
  }

  const resetForm = () => {
    setFormData(EMPTY_FORM)
    setEditingRecord(null)
    setShowForm(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.property_name.trim()) {
      showToast('매물명을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    const salePrice = toLedgerAmountNumber(formData.sale_price)
    if (salePrice <= 0) {
      showToast('매매가를 올바르게 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      const dataToSave = {
        property_name: formData.property_name.trim(),
        address: formData.address || null,
        purchase_date: formData.purchase_date || null,
        sale_price: salePrice,
        memo: formData.memo || null,
      }

      if (editingRecord) {
        await updateOfficetelPurchaseRecord(editingRecord.id, dataToSave)
        showToast('매물 기록이 수정되었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await saveOfficetelPurchaseRecord(dataToSave)
        showToast('매물 기록이 추가되었습니다.', TOAST_TYPES.SUCCESS)
      }

      resetForm()
      await loadAll()
    } catch (error) {
      console.error('매물 기록 저장 실패:', error)
      showToast('매물 기록 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleEdit = (record) => {
    setEditingRecord(record)
    setFormData({
      property_name: record.property_name,
      address: record.address || '',
      purchase_date: record.purchase_date || format(new Date(), 'yyyy-MM-dd'),
      sale_price: String(record.sale_price),
      memo: record.memo || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (recordId) => {
    if (!window.confirm('이 매물 기록을 삭제하시겠습니까? 분담 내역과 기타 비용도 함께 삭제됩니다.')) return

    try {
      await deleteOfficetelPurchaseRecord(recordId)
      showToast('매물 기록이 삭제되었습니다.', TOAST_TYPES.SUCCESS)
      if (expandedId === recordId) setExpandedId(null)
      await loadAll()
    } catch (error) {
      console.error('매물 기록 삭제 실패:', error)
      showToast('매물 기록 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col">
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-handwriting text-gray-800 mb-2">오피스텔 매매 기록</h1>
          <p className="text-lg text-gray-600 font-sans">매매가, 분담 내역, 복비·법무사비 등을 기록하세요</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium shadow-md font-sans"
        >
          + 매물 추가
        </button>
      </div>

      {/* 폼 모달 */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={resetForm}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-amber-50 px-6 py-4 border-b-2 border-amber-200 flex items-center justify-between">
              <h2 className="text-2xl font-handwriting text-gray-800">
                {editingRecord ? '매물 정보 수정' : '새 매물 추가'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2 font-sans">매물명 *</label>
                  <input
                    type="text"
                    value={formData.property_name}
                    onChange={(e) => setFormData({ ...formData, property_name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-base bg-white font-sans"
                    placeholder="예: OO오피스텔 101동 1001호"
                    required
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2 font-sans">주소</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-base bg-white font-sans"
                    placeholder="선택 입력"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-medium text-gray-700 mb-2 font-sans">매매일</label>
                    <input
                      type="date"
                      value={formData.purchase_date}
                      onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-base bg-white font-sans"
                    />
                  </div>
                  <LedgerAmountInput
                    label="매매가"
                    value={formData.sale_price}
                    onChange={(digits) => setFormData({ ...formData, sale_price: digits })}
                    required
                    showQuickAdd={false}
                    inputClassName="w-full px-4 py-2 border-2 border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-base bg-white font-sans"
                  />
                </div>
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2 font-sans">메모</label>
                  <textarea
                    value={formData.memo}
                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-base bg-white font-sans"
                    rows={3}
                    placeholder="선택 입력"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-sans font-medium shadow-md"
                  >
                    {editingRecord ? '수정' : '저장'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-sans font-medium"
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 매물 목록 */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-6">
        {loading ? (
          <div className="text-center py-12 text-gray-500 font-sans">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
            <p>로딩 중...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-base text-gray-500 mb-2 font-sans">등록된 매물이 없습니다.</p>
            <p className="text-sm text-gray-400 font-sans">새 매물을 추가해보세요.</p>
          </div>
        ) : (
          records.map((record) => {
            const costTotal = totals.costTotals[record.id] || 0
            const isExpanded = expandedId === record.id

            return (
              <div key={record.id} className="bg-white/80 backdrop-blur-sm rounded-lg border-2 border-gray-200 hover:border-amber-300 transition-colors shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="text-xl font-sans font-bold text-gray-800">{record.property_name}</span>
                        {record.purchase_date && (
                          <span className="text-sm text-gray-500 font-sans">{record.purchase_date}</span>
                        )}
                      </div>
                      {record.address && <div className="text-sm text-gray-600 font-sans mb-1">{record.address}</div>}
                      <div className="text-sm font-sans text-gray-700 flex flex-wrap gap-x-4 gap-y-1">
                        <span>매매가 <b className="text-gray-800">{Number(record.sale_price).toLocaleString()}원</b></span>
                        <span>기타비용 <b className="text-gray-800">{costTotal.toLocaleString()}원</b></span>
                      </div>
                      {record.memo && <div className="text-sm text-gray-500 font-sans mt-1">{record.memo}</div>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : record.id)}
                        className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-sans text-sm"
                      >
                        {isExpanded ? '접기' : '상세보기'}
                      </button>
                      <button
                        onClick={() => handleEdit(record)}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-sans text-sm"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-sans text-sm"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <OfficetelPurchaseDetail purchase={record} onTotalsChange={loadTotals} />
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
