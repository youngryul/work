import { useState, useEffect } from 'react'
import { createReadingRecord, updateReadingRecord } from '../../services/readingService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 한국 시간대 기준으로 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 * @returns {string} 오늘 날짜 문자열
 */
const getTodayDateString = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 독서 기록 폼 컴포넌트
 */
export default function ReadingRecordForm({ book, initialRecord, onSave, onCancel }) {
  const [readingDate, setReadingDate] = useState(getTodayDateString())
  const [pagesRead, setPagesRead] = useState('')
  const [notes, setNotes] = useState('')

  // 수정 모드일 때 초기값 설정
  useEffect(() => {
    if (initialRecord) {
      setReadingDate(initialRecord.readingDate || getTodayDateString())
      setPagesRead(initialRecord.pagesRead ? String(initialRecord.pagesRead) : '')
      setNotes(initialRecord.notes || '')
    }
  }, [initialRecord])

  /**
   * 기록 저장
   */
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!book) {
      showToast('책을 선택해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      const payload = {
        readingDate,
        startTime: null,
        endTime: null,
        readingMinutes: null,
        pagesRead: pagesRead ? parseInt(pagesRead, 10) : null,
        notes: notes.trim() || null,
      }

      if (initialRecord) {
        await updateReadingRecord(initialRecord.id, payload)
      } else {
        await createReadingRecord({
          bookId: book.id,
          ...payload,
        })
      }

      onSave?.()
      setPagesRead('')
      setNotes('')
    } catch (error) {
      console.error('독서 기록 저장 오류:', error)
      showToast('독서 기록 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-3xl font-bold text-gray-800 mb-4">
        {initialRecord ? '독서 기록 수정' : '독서 기록'}
      </h2>

      {book && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-xl font-bold text-gray-800 mb-1">{book.title}</h3>
          <p className="text-gray-600 text-sm">저자: {book.author || '알 수 없음'}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            독서 날짜 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={readingDate}
            onChange={(e) => setReadingDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            required
          />
        </div>

        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            읽은 페이지
          </label>
          <input
            type="number"
            value={pagesRead}
            onChange={(e) => setPagesRead(e.target.value)}
            min="0"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder="읽은 페이지 수를 입력하세요"
          />
        </div>

        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            메모
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder="독서 메모를 입력하세요"
            rows={4}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 text-base font-medium"
            >
              취소
            </button>
          )}
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
