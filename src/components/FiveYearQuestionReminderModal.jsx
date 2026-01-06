import { useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { createTask } from '../services/taskService.js'
import { getDefaultCategory } from '../services/categoryService.js'

/**
 * 오늘 5년 질문 일기 작성 리마인더 모달 컴포넌트
 * @param {string} todayDate - 오늘 날짜 (YYYY-MM-DD)
 * @param {Object} question - 질문 객체
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {Function} onClose - 닫기 핸들러 (질문 답변 완료 또는 취소)
 * @param {Function} onAnswerQuestion - 질문 답변 핸들러
 */
export default function FiveYearQuestionReminderModal({ todayDate, question, isOpen, onClose, onAnswerQuestion }) {
  if (!isOpen || !question) return null

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString + 'T00:00:00'), 'yyyy년 MM월 dd일 (EEE)', { locale: ko })
    } catch {
      return dateString
    }
  }

  /**
   * 질문 답변하기 클릭 - 5년 질문 페이지로 이동
   */
  const handleAnswerQuestion = () => {
    if (onAnswerQuestion) {
      onAnswerQuestion()
    }
    onClose()
  }

  /**
   * 나중에 하기 클릭 - todo에 추가하고 닫기
   */
  const handleLater = async () => {
    try {
      const defaultCategory = await getDefaultCategory()
      await createTask(`오늘의 5년 질문 답변하기`, defaultCategory, true)
      onClose()
    } catch (error) {
      console.error('할 일 추가 실패:', error)
      alert('할 일 추가에 실패했습니다.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      {/* 리마인더 메시지 */}
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2 font-sans">
            오늘의 질문에 답하세요
          </h2>
          <p className="text-base text-gray-600 font-sans mb-3">
            {formatDate(todayDate)}의 질문입니다.
          </p>
          <div className="bg-pink-50 border-l-4 border-pink-400 p-4 rounded">
            <p className="text-base text-gray-800 font-medium font-sans">
              {question.question_text}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleLater}
            className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-base font-medium font-sans"
          >
            나중에 하기
          </button>
          <button
            onClick={handleAnswerQuestion}
            className="flex-1 px-4 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors text-base font-medium font-sans"
          >
            지금 답하기
          </button>
        </div>
      </div>
    </div>
  )
}

