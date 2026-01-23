import { useState } from 'react'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 한줄 인사이트 입력 모달
 * @param {Object} book - 책 정보
 * @param {Function} onSave - 저장 콜백 (oneLineInsight를 인자로 받음)
 * @param {Function} onCancel - 취소 콜백
 */
export default function OneLineInsightModal({ book, onSave, onCancel }) {
  const [insight, setInsight] = useState('')

  const handleSave = () => {
    if (!insight.trim()) {
      showToast('한줄 인사이트를 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    onSave(insight.trim())
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl font-bold text-gray-800">한줄 인사이트</h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 text-4xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="mb-4">
            <div className="flex gap-4 mb-4">
              {book.thumbnailUrl && (
                <img
                  src={book.thumbnailUrl}
                  alt={book.title}
                  className="w-20 h-28 object-cover rounded border border-gray-300"
                />
              )}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800 mb-1">{book.title}</h3>
                <p className="text-gray-600 text-sm">저자: {book.author || '알 수 없음'}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이 책에 대한 한줄 인사이트를 입력해주세요
            </label>
            <textarea
              value={insight}
              onChange={(e) => setInsight(e.target.value)}
              placeholder="예: 인생의 의미에 대해 깊이 생각하게 해준 책"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
              rows={4}
              maxLength={200}
            />
            <div className="text-right text-sm text-gray-500 mt-1">
              {insight.length}/200
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 text-lg font-medium"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-lg font-medium"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
