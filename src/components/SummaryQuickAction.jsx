import { useState } from 'react'
import { getLastWeekInfo, getLastMonthInfo } from '../utils/summaryReminder.js'

/**
 * 주간/월간 요약 빠른 생성 버튼 컴포넌트
 * 모든 페이지에 표시되는 플로팅 버튼
 */
export default function SummaryQuickAction() {
  const [showMenu, setShowMenu] = useState(false)

  /**
   * 주간 업무일지 생성
   */
  const handleGenerateWeeklyWork = () => {
    const lastWeek = getLastWeekInfo()
    if (window.setCurrentView) {
      window.setCurrentView('review-2026')
      window.setReview2026Tab('weekly-work')
      window.setReview2026Params({ 
        tab: 'weekly-work', 
        weekStart: lastWeek.weekStart, 
        weekEnd: lastWeek.weekEnd 
      })
    }
    setShowMenu(false)
  }

  /**
   * 주간 일기 정리 생성
   */
  const handleGenerateWeeklyDiary = () => {
    const lastWeek = getLastWeekInfo()
    if (window.setCurrentView) {
      window.setCurrentView('review-2026')
      window.setReview2026Tab('weekly-diary')
      window.setReview2026Params({ 
        tab: 'weekly-diary', 
        weekStart: lastWeek.weekStart, 
        weekEnd: lastWeek.weekEnd 
      })
    }
    setShowMenu(false)
  }

  /**
   * 월간 일기 정리 생성
   */
  const handleGenerateMonthlyDiary = () => {
    const lastMonth = getLastMonthInfo()
    if (window.setCurrentView) {
      window.setCurrentView('review-2026')
      window.setReview2026Tab('monthly-diary')
      window.setReview2026Params({ 
        tab: 'monthly-diary', 
        year: lastMonth.year, 
        month: lastMonth.month 
      })
    }
    setShowMenu(false)
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {showMenu ? (
        <div className="bg-white rounded-lg shadow-xl border border-gray-200 p-2 mb-2">
          <button
            onClick={handleGenerateWeeklyWork}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors mb-1"
          >
            📊 주간 업무일지 생성
          </button>
          <button
            onClick={handleGenerateWeeklyDiary}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors mb-1"
          >
            📝 주간 일기 정리 생성
          </button>
          <button
            onClick={handleGenerateMonthlyDiary}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            📔 월간 일기 정리 생성
          </button>
        </div>
      ) : null}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-14 h-14 bg-indigo-500 text-white rounded-full shadow-lg hover:bg-indigo-600 transition-colors flex items-center justify-center text-2xl font-bold"
        title="요약 생성"
      >
        {showMenu ? '×' : '📋'}
      </button>
    </div>
  )
}

