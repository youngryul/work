import { useState, useEffect } from 'react'
import { BUCKETLIST_STATUS, BUCKETLIST_STATUS_LABELS } from '../../constants/bucketlistConstants.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 버킷리스트 추가/수정 폼 컴포넌트
 */
export default function BucketlistForm({ initialData, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    status: BUCKETLIST_STATUS.NOT_COMPLETED,
    targetDate: '',
  })

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        status: initialData.status || BUCKETLIST_STATUS.NOT_COMPLETED,
        targetDate: initialData.targetDate ? initialData.targetDate.split('T')[0] : '',
      })
    }
  }, [initialData])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      showToast('제목을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    // 추가 시에는 제목만, 수정 시에는 모든 필드 포함
    if (initialData) {
      onSave({
        ...formData,
        targetDate: formData.targetDate || null,
      })
    } else {
      // 추가 시 제목만 저장
      onSave({
        title: formData.title.trim(),
        status: BUCKETLIST_STATUS.NOT_COMPLETED,
        targetDate: null,
      })
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">
        {initialData ? '버킷리스트 수정' : '새 버킷리스트 추가'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {initialData ? (
          // 수정 시에는 모든 필드 표시
          <>
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                placeholder="버킷리스트 제목을 입력하세요"
                required
              />
            </div>

            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">
                상태
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              >
                {Object.entries(BUCKETLIST_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">
                목표 날짜 (선택사항)
              </label>
              <input
                type="date"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              />
            </div>
          </>
        ) : (
          // 추가 시에는 제목만 표시
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              placeholder="버킷리스트 제목을 입력하세요"
              autoFocus
              required
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4">
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
            {initialData ? '수정' : '추가'}
          </button>
        </div>
      </form>
    </div>
  )
}

