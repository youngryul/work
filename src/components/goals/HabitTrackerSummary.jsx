/**
 * 이전 달 Habit Tracker 완료 종합판 컴포넌트
 * 다음 달 1일에 이전 달의 각 habit tracker 완료 여부를 표시
 */
import { useState, useEffect } from 'react'
import { getPreviousMonthHabitTrackerSummary } from '../../services/goalService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * @param {number} currentYear - 현재 연도
 * @param {number} currentMonth - 현재 월
 * @param {Function} onClose - 닫기 핸들러
 */
export default function HabitTrackerSummary({ currentYear, currentMonth, onClose }) {
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSummary()
  }, [currentYear, currentMonth])

  const loadSummary = async () => {
    try {
      setLoading(true)
      const data = await getPreviousMonthHabitTrackerSummary(currentYear, currentMonth)
      setSummary(data)
    } catch (error) {
      console.error('종합판 로드 실패:', error)
      showToast('종합판을 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  // 다음 달 1일인지 확인
  const today = new Date()
  const isFirstDayOfMonth = today.getDate() === 1

  // 이전 달 정보 계산
  let prevYear = currentYear
  let prevMonth = currentMonth - 1
  if (prevMonth < 1) {
    prevMonth = 12
    prevYear = currentYear - 1
  }

  // 다음 달 1일이 아니거나 데이터가 없으면 표시하지 않음
  if (!isFirstDayOfMonth || summary.length === 0) {
    return null
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
            <p className="text-gray-600 font-sans">로딩 중...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 font-sans">
              {prevYear}년 {prevMonth}월 Habit Tracker 종합판
            </h2>
            <p className="text-sm text-gray-600 mt-1 font-sans">
              지난 달 습관 추적 결과를 확인해보세요!
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* 종합 목록 */}
        <div className="space-y-4">
          {summary.map((tracker) => (
            <div
              key={tracker.id}
              className="bg-gray-50 rounded-lg border-2 border-gray-200 p-4"
            >
              {/* 제목 */}
              <div className="flex items-center justify-between mb-3">
                <div
                  className="px-3 py-1 rounded-lg"
                  style={{ backgroundColor: tracker.color }}
                >
                  <h3 className="text-base font-semibold text-gray-800 font-sans">
                    {tracker.title}
                  </h3>
                </div>
                <span className={`px-3 py-1 rounded-lg text-sm font-bold font-sans ${
                  tracker.completionRate >= 80
                    ? 'bg-green-100 text-green-800'
                    : tracker.completionRate >= 50
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {tracker.completionRate}%
                </span>
              </div>

              {/* 진행률 바 */}
              <div className="mb-2">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${tracker.completionRate}%`,
                      backgroundColor: tracker.color,
                    }}
                  />
                </div>
              </div>

              {/* 통계 */}
              <div className="flex items-center justify-between text-sm text-gray-600 font-sans">
                <span>
                  완료: {tracker.completedDays}일 / 전체: {tracker.totalDays}일
                </span>
                <span>
                  {tracker.completionRate >= 80 ? '🎉 훌륭해요!' :
                   tracker.completionRate >= 50 ? '👍 잘하고 있어요!' :
                   '💪 다음 달 더 노력해봐요!'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 닫기 버튼 */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-base font-medium shadow-md font-sans"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

