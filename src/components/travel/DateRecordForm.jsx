import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { saveDateRecord, getDateRecord } from '../../services/travelService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 날짜별 기록 등록/수정 폼 컴포넌트
 */
export default function DateRecordForm({ travelId, initialDate, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    recordDate: initialDate || format(new Date(), 'yyyy-MM-dd'),
    content: '',
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (initialDate) {
      loadExistingRecord()
    }
  }, [initialDate, travelId])

  const loadExistingRecord = async () => {
    if (!initialDate || !travelId) return

    setIsLoading(true)
    try {
      const record = await getDateRecord(travelId, initialDate)
      if (record) {
        setFormData({
          recordDate: record.recordDate,
          content: record.content || '',
        })
      } else {
        setFormData({
          recordDate: initialDate,
          content: '',
        })
      }
    } catch (error) {
      console.error('기록 로드 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.recordDate) {
      showToast('날짜를 선택해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      await saveDateRecord({
        travelId,
        recordDate: formData.recordDate,
        content: formData.content || null,
      })
      showToast('기록이 저장되었습니다.', TOAST_TYPES.SUCCESS)
      onSave()
    } catch (error) {
      console.error('기록 저장 오류:', error)
      showToast(error.message || '저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-500 text-xl">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">
        날짜별 기록 {initialDate ? '수정' : '작성'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 날짜 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            날짜 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.recordDate}
            onChange={(e) => setFormData({ ...formData, recordDate: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            required
          />
        </div>

        {/* 내용 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            기록 내용
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder="이 날의 여행 기록을 작성해보세요..."
            rows={10}
          />
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 text-base font-medium"
          >
            취소
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-base font-medium"
          >
            저장
          </button>
        </div>
      </form>
    </div>
  )
}
