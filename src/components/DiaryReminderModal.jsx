import { useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import DiaryForm from './DiaryForm.jsx'
import { createTask } from '../services/taskService.js'
import { getDefaultCategory } from '../services/categoryService.js'

/**
 * 전날 일기 작성 리마인더 모달 컴포넌트
 * @param {string} yesterdayDate - 어제 날짜 (YYYY-MM-DD)
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {Function} onClose - 닫기 핸들러 (일기 작성 완료 또는 취소)
 * @param {Function} onWriteDiary - 일기 작성 핸들러
 */
export default function DiaryReminderModal({ yesterdayDate, isOpen, onClose, onWriteDiary }) {
  const [showDiaryForm, setShowDiaryForm] = useState(false)

  if (!isOpen) return null

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString + 'T00:00:00'), 'yyyy년 MM월 dd일 (EEE)', { locale: ko })
    } catch {
      return dateString
    }
  }

  /**
   * 일기 작성하기 클릭
   */
  const handleWriteDiary = () => {
    setShowDiaryForm(true)
  }

  /**
   * 나중에 하기 클릭 - todo에 추가하고 닫기
   */
  const handleLater = async () => {
    try {
      const defaultCategory = await getDefaultCategory()
      await createTask(`${formatDate(yesterdayDate)} 일기 작성`, defaultCategory, true)
      onClose()
    } catch (error) {
      console.error('할 일 추가 실패:', error)
      alert('할 일 추가에 실패했습니다.')
    }
  }

  /**
   * 일기 작성 완료
   */
  const handleDiarySave = () => {
    setShowDiaryForm(false)
    onClose()
    if (onWriteDiary) {
      onWriteDiary()
    }
  }

  /**
   * 일기 작성 취소
   */
  const handleDiaryCancel = () => {
    setShowDiaryForm(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      {showDiaryForm ? (
        // 일기 작성 폼 팝업
        <div 
          className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-1 overflow-y-auto p-6">
            <DiaryForm
              selectedDate={yesterdayDate}
              onSave={handleDiarySave}
              onCancel={handleDiaryCancel}
              isModal={true}
            />
          </div>
        </div>
      ) : (
        // 리마인더 메시지
        <div 
          className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 font-sans">
              어제 일기를 작성하세요
            </h2>
            <p className="text-base text-gray-600 font-sans">
              {formatDate(yesterdayDate)}의 일기를 작성해주세요.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleLater}
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-base font-medium font-sans"
            >
              나중에 하기
            </button>
            <button
              onClick={handleWriteDiary}
              className="flex-1 px-4 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors text-base font-medium font-sans"
            >
              지금 작성하기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
