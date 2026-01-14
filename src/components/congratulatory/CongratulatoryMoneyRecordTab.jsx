import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import {
  getCongratulatoryMoneyRecords,
  saveCongratulatoryMoneyRecord,
  updateCongratulatoryMoneyRecord,
  deleteCongratulatoryMoneyRecord,
} from '../../services/congratulatoryMoneyService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 축의금/부조금 기록 탭 컴포넌트
 */
export default function CongratulatoryMoneyRecordTab() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [filterType, setFilterType] = useState('') // '' | '축의금' | '부조금'
  const [formData, setFormData] = useState({
    type: '축의금',
    amount: '',
    recipient_name: '',
    relationship: '',
    phone_number: '',
    event_date: format(new Date(), 'yyyy-MM-dd'),
  })

  useEffect(() => {
    loadRecords()
  }, [filterType])

  /**
   * 기록 목록 로드
   */
  const loadRecords = async () => {
    try {
      setLoading(true)
      const options = filterType ? { type: filterType } : {}
      const data = await getCongratulatoryMoneyRecords(options)
      setRecords(data)
    } catch (error) {
      console.error('기록 로드 실패:', error)
      showToast('기록을 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  /**
   * 폼 초기화
   */
  const resetForm = () => {
    setFormData({
      type: '축의금',
      amount: '',
      recipient_name: '',
      relationship: '',
      phone_number: '',
      event_date: format(new Date(), 'yyyy-MM-dd'),
    })
    setEditingRecord(null)
    setShowForm(false)
  }

  /**
   * 기록 저장
   */
  const handleSave = async (e) => {
    e.preventDefault()

    if (!formData.recipient_name.trim()) {
      showToast('받는 사람 이름을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      showToast('금액을 올바르게 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      const dataToSave = {
        ...formData,
        amount: Number(formData.amount),
        phone_number: formData.phone_number || null,
      }

      if (editingRecord) {
        await updateCongratulatoryMoneyRecord(editingRecord.id, dataToSave)
        showToast('기록이 수정되었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await saveCongratulatoryMoneyRecord(dataToSave)
        showToast('기록이 저장되었습니다.', TOAST_TYPES.SUCCESS)
      }

      resetForm()
      loadRecords()
    } catch (error) {
      console.error('기록 저장 실패:', error)
      showToast('기록 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 기록 수정 시작
   */
  const handleEdit = (record) => {
    setEditingRecord(record)
    setFormData({
      type: record.type,
      amount: record.amount.toString(),
      recipient_name: record.recipient_name,
      relationship: record.relationship || '',
      phone_number: record.phone_number || '',
      event_date: record.event_date,
    })
    setShowForm(true)
  }

  /**
   * 기록 삭제
   */
  const handleDelete = async (recordId) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return

    try {
      await deleteCongratulatoryMoneyRecord(recordId)
      showToast('기록이 삭제되었습니다.', TOAST_TYPES.SUCCESS)
      loadRecords()
    } catch (error) {
      console.error('기록 삭제 실패:', error)
      showToast('기록 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 총액 계산
   */
  const totalAmount = records.reduce((sum, record) => sum + record.amount, 0)
  const 축의금Total = records
    .filter((r) => r.type === '축의금')
    .reduce((sum, r) => sum + r.amount, 0)
  const 부조금Total = records
    .filter((r) => r.type === '부조금')
    .reduce((sum, r) => sum + r.amount, 0)

  // 목록 뷰
  return (
    <>
      {/* 폼 모달 */}
      {showForm && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={resetForm}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="bg-pink-50 px-6 py-4 border-b-2 border-pink-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-handwriting text-gray-800 mb-1">
                  {editingRecord ? '기록 수정' : '새 기록 추가'}
                </h2>
                <p className="text-base text-gray-600 font-sans">
                  축의금 또는 부조금 기록을 추가하세요.
                </p>
              </div>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            {/* 컨텐츠 */}
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">유형 *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
                  required
                >
                  <option value="축의금">축의금</option>
                  <option value="부조금">부조금</option>
                </select>
              </div>
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">금액 *</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
                  placeholder="예: 50000"
                  required
                  min="1"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">받는 사람 이름 *</label>
                <input
                  type="text"
                  value={formData.recipient_name}
                  onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
                  placeholder="예: 홍길동"
                  required
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">관계</label>
                <input
                  type="text"
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
                  placeholder="예: 친구, 동료"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">전화번호</label>
                <input
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
                  placeholder="예: 010-1234-5678"
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">경조사 날짜 *</label>
                <input
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors font-sans font-medium shadow-md"
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

      <div className="space-y-6 pb-6">
      {/* 필터 및 추가 버튼 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
          >
            <option value="">전체</option>
            <option value="축의금">축의금</option>
            <option value="부조금">부조금</option>
          </select>
          <div className="text-base font-sans text-gray-700">
            총 {records.length}건 | 총액: {totalAmount.toLocaleString()}원
            {filterType === '' && (
              <>
                {' '}
                (축의금: {축의금Total.toLocaleString()}원, 부조금: {부조금Total.toLocaleString()}원)
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="px-4 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors text-sm font-medium shadow-md font-sans"
        >
          + 기록 추가
        </button>
      </div>

      {/* 기록 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 font-sans">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400 mx-auto mb-4"></div>
          <p>로딩 중...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-base text-gray-500 mb-2 font-sans">등록된 기록이 없습니다.</p>
          <p className="text-sm text-gray-400 font-sans">새 기록을 추가해보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <div
              key={record.id}
              className="p-4 bg-white/80 backdrop-blur-sm rounded-lg border-2 border-gray-200 hover:border-pink-300 transition-colors shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-sans font-medium ${
                        record.type === '축의금'
                          ? 'bg-pink-100 text-pink-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {record.type}
                    </span>
                    <span className="text-xl font-sans font-bold text-gray-800">
                      {record.amount.toLocaleString()}원
                    </span>
                  </div>
                  <div className="text-lg font-sans font-medium text-gray-800 mb-1">
                    {record.recipient_name}
                  </div>
                  <div className="text-sm text-gray-600 font-sans space-y-1">
                    {record.relationship && <div>관계: {record.relationship}</div>}
                    {record.phone_number && <div>전화번호: {record.phone_number}</div>}
                    <div>
                      날짜:{' '}
                      {format(new Date(record.event_date + 'T00:00:00'), 'yyyy년 MM월 dd일', { locale: ko })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
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
            </div>
          ))}
        </div>
      )}
    </div>
    </>
  )
}
