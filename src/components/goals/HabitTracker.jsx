/**
 * Habit Tracker 컴포넌트
 * 하트 모양의 달력으로 습관을 추적하는 컴포넌트
 */
import { useState, useEffect } from 'react'
import { toggleHabitTrackerDay } from '../../services/goalService.js'

/**
 * 하트 모양 그리드 패턴
 * 각 행의 셀 위치를 정의 (1부터 시작, 0은 빈 셀)
 */
const HEART_GRID_PATTERN = [
  [0, 0, 1, 2, 3, 0, 0],   // Row 1
  [0, 0, 4, 5, 6, 0, 0],   // Row 2
  [7, 8, 9, 10, 11, 12, 13], // Row 3
  [14, 15, 16, 17, 18, 19, 20], // Row 4
  [0, 21, 22, 23, 24, 25, 0], // Row 5
  [0, 0, 26, 27, 28, 0, 0], // Row 6
  [0, 0, 0, 29, 0, 0, 0],   // Row 7
]

/**
 * @param {Object} tracker - Habit Tracker 데이터
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {Function} onUpdate - 업데이트 핸들러
 */
export default function HabitTracker({ tracker, year, month, onUpdate }) {
  const [days, setDays] = useState([])
  const [animatingDay, setAnimatingDay] = useState(null)
  const [totalDays, setTotalDays] = useState(0)

  useEffect(() => {
    if (tracker && tracker.days) {
      setDays(tracker.days)
      setTotalDays(getDaysInMonth(year, month))
    }
  }, [tracker, year, month])

  /**
   * 특정 날짜의 완료 상태 확인
   */
  const getDayStatus = (day) => {
    if (day === 0 || day > totalDays) return null
    const dayData = days.find(d => d.day === day)
    return dayData ? dayData.isCompleted : false
  }

  /**
   * 날짜 클릭 핸들러
   */
  const handleDayClick = async (day) => {
    if (day === 0 || day > totalDays || !tracker) return

    const currentStatus = getDayStatus(day)
    const newStatus = !currentStatus

    // 애니메이션 시작
    setAnimatingDay(day)

    try {
      await toggleHabitTrackerDay(tracker.id, day, newStatus)
      
      // 로컬 상태 업데이트
      const dayData = days.find(d => d.day === day)
      if (dayData) {
        setDays(days.map(d => 
          d.id === dayData.id 
            ? { ...d, isCompleted: newStatus, completedAt: newStatus ? new Date().toISOString() : null }
            : d
        ))
      } else {
        // 새로 생성
        setDays([...days, {
          id: `temp-${day}`,
          habitTrackerId: tracker.id,
          day: day,
          isCompleted: newStatus,
          completedAt: newStatus ? new Date().toISOString() : null,
        }])
      }

      // 애니메이션 종료
      setTimeout(() => {
        setAnimatingDay(null)
      }, 600)

      onUpdate?.()
    } catch (error) {
      console.error('Habit Tracker 업데이트 실패:', error)
      alert('업데이트에 실패했습니다.')
      setAnimatingDay(null)
    }
  }

  /**
   * 완료율 계산
   */
  const completedCount = days.filter(d => d.isCompleted).length
  const completionRate = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-5 hover:border-pink-300 transition-all duration-200">
      {/* 제목 바 */}
      <div 
        className="rounded-t-lg px-4 py-2 mb-4"
        style={{ backgroundColor: tracker?.color || '#FFB6C1' }}
      >
        <h3 className="text-lg font-semibold text-gray-800 font-sans">
          {tracker?.title || 'Habit Tracker'}
        </h3>
      </div>

      {/* 하트 모양 달력 */}
      <div className="flex flex-col items-center mb-4">
        <div className="grid grid-cols-7 gap-1">
          {HEART_GRID_PATTERN.map((row, rowIndex) => (
            row.map((day, colIndex) => {
              if (day === 0) {
                return <div key={`${rowIndex}-${colIndex}`} className="w-8 h-8" />
              }

              const isCompleted = getDayStatus(day)
              const isAnimating = animatingDay === day
              const isPast = day <= new Date().getDate() && month === new Date().getMonth() + 1 && year === new Date().getFullYear()
              const isFuture = day > totalDays

              return (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  onClick={() => handleDayClick(day)}
                  disabled={isFuture}
                  className={`
                    w-8 h-8 rounded text-xs font-medium
                    transition-all duration-300
                    ${isFuture 
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                      : isCompleted
                        ? 'bg-pink-400 text-white shadow-md scale-110'
                        : 'bg-gray-200 text-gray-600 hover:bg-pink-200 hover:scale-105'
                    }
                    ${isAnimating ? 'animate-pulse scale-125' : ''}
                    ${!isPast && !isCompleted ? 'opacity-60' : ''}
                  `}
                  style={{
                    backgroundColor: isCompleted ? (tracker?.color || '#FFB6C1') : undefined,
                  }}
                >
                  {day}
                </button>
              )
            })
          ))}
        </div>
      </div>

      {/* 완료율 표시 */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600 font-sans">완료율</span>
          <span className="text-xs font-bold text-gray-800 font-sans">
            {completedCount} / {totalDays} ({completionRate}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{ 
              width: `${completionRate}%`,
              backgroundColor: tracker?.color || '#FFB6C1',
            }}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * 특정 연도/월의 일수 계산
 */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

