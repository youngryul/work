/**
 * Habit Tracker 독립 뷰 컴포넌트
 * 메뉴에서 별도로 진입하는 습관 트래커 전용 페이지
 */
import { useState, useEffect } from 'react'
import { getMonthlyGoals } from '../../services/goalService.js'
import HabitTrackerList from './HabitTrackerList.jsx'
import HabitTrackerSummary from './HabitTrackerSummary.jsx'

const CURRENT_YEAR = 2026

export default function HabitTrackerView() {
  const [currentYear] = useState(CURRENT_YEAR)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [monthlyGoals, setMonthlyGoals] = useState([])
  const [showHabitTrackerSummary, setShowHabitTrackerSummary] = useState(false)

  // 선택한 연·월의 월별 목표 로드 (Habit Tracker 생성 시 선택용)
  useEffect(() => {
    const loadMonthlyGoals = async () => {
      try {
        const goals = await getMonthlyGoals(currentYear, currentMonth)
        setMonthlyGoals(goals)
      } catch (error) {
        console.error('월별 목표 로드 실패:', error)
        setMonthlyGoals([])
      }
    }
    loadMonthlyGoals()
  }, [currentYear, currentMonth])

  // 다음 달 1일인지 확인하여 종합판 표시
  useEffect(() => {
    const today = new Date()
    const isFirstDayOfMonth = today.getDate() === 1
    const isCurrentMonth = today.getMonth() + 1 === currentMonth && today.getFullYear() === currentYear

    if (isFirstDayOfMonth && isCurrentMonth) {
      const summaryShownToday = localStorage.getItem(`habitTrackerSummary_${currentYear}_${currentMonth}`)
      if (!summaryShownToday) {
        setShowHabitTrackerSummary(true)
        localStorage.setItem(`habitTrackerSummary_${currentYear}_${currentMonth}`, 'true')
      }
    }
  }, [currentYear, currentMonth])

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 font-sans">
          습관 트래커
        </h1>
        <p className="text-base text-gray-600 font-sans">
          월별로 습관을 등록하고 매일 체크하여 꾸준히 실천해보세요.
        </p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <label className="text-base font-medium text-gray-700 font-sans">월 선택:</label>
        <select
          value={currentMonth}
          onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
          className="px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
            <option key={month} value={month}>
              {currentYear}년 {month}월
            </option>
          ))}
        </select>
      </div>

      <HabitTrackerList
        year={currentYear}
        month={currentMonth}
        monthlyGoals={monthlyGoals}
      />

      {showHabitTrackerSummary && (
        <HabitTrackerSummary
          currentYear={currentYear}
          currentMonth={currentMonth}
          onClose={() => setShowHabitTrackerSummary(false)}
        />
      )}
    </div>
  )
}
