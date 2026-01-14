import { useState } from 'react'
import { createTask } from '../services/taskService.js'
import { getDefaultCategory } from '../services/categoryService.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * 주간/월간 요약 생성 리마인더 모달 컴포넌트
 * @param {string} type - 'weekly' | 'monthly'
 * @param {string} period - 기간 설명 (예: "2025년 12월 23일 ~ 12월 29일" 또는 "2025년 12월")
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {Function} onClose - 닫기 핸들러
 * @param {Function} onGenerate - 생성 핸들러
 */
export default function SummaryReminderModal({ type, period, isOpen, onClose, onGenerate }) {
  if (!isOpen) return null

  const title = type === 'weekly' 
    ? '주간 업무/일기 요약을 생성하세요'
    : '월간 업무/일기 요약을 생성하세요'
  
  const taskTitle = type === 'weekly'
    ? `주간 업무/일기 요약 생성 (${period})`
    : `월간 업무/일기 요약 생성 (${period})`

  /**
   * 나중에 하기 클릭 - todo에 추가하고 닫기
   */
  const handleLater = async () => {
    try {
      const defaultCategory = await getDefaultCategory()
      await createTask(taskTitle, defaultCategory, true)
      onClose()
    } catch (error) {
      console.error('할 일 추가 실패:', error)
      showToast('할 일 추가에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 지금 생성하기 클릭
   */
  const handleGenerate = () => {
    onGenerate?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2 font-sans">
            {title}
          </h2>
          <p className="text-base text-gray-600 font-sans">
            {period}의 업무일지와 일기를 정리하여 요약을 생성해주세요.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleLater}
            className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-base font-medium font-sans"
          >
            나중에
          </button>
          <button
            onClick={handleGenerate}
            className="flex-1 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-base font-medium font-sans"
          >
            지금 생성하기
          </button>
        </div>
      </div>
    </div>
  )
}

