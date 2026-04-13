/**
 * Habit Tracker 컴포넌트
 * 하트 모양의 달력으로 습관을 추적하는 컴포넌트
 */
import { useState, useEffect, useRef } from 'react'
import { toggleHabitTrackerDay, updateHabitTrackerTitle } from '../../services/goalService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 바둑판 형태의 그리드 생성 함수
 * 해당 월의 일수에 맞춰 격자 형태로 날짜를 배치
 */
const generateGridPattern = (totalDays) => {
  const rows = []
  const daysPerRow = 7 // 주 7일
  let currentDay = 1
  
  while (currentDay <= totalDays) {
    const row = []
    for (let i = 0; i < daysPerRow && currentDay <= totalDays; i++) {
      row.push(currentDay)
      currentDay++
    }
    // 마지막 행이 7개가 아니면 빈 셀로 채움
    while (row.length < daysPerRow) {
      row.push(0)
    }
    rows.push(row)
  }
  
  return rows
}

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
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [titleSaving, setTitleSaving] = useState(false)
  const titleInputRef = useRef(null)

  useEffect(() => {
    if (tracker && tracker.days) {
      setDays(tracker.days)
      setTotalDays(getDaysInMonth(year, month))
    }
  }, [tracker, year, month])

  useEffect(() => {
    if (tracker?.title != null && !isEditingTitle) {
      setTitleDraft(tracker.title)
    }
  }, [tracker?.title, tracker?.id, isEditingTitle])

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

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
      showToast('업데이트에 실패했습니다.', TOAST_TYPES.ERROR)
      setAnimatingDay(null)
    }
  }

  /**
   * 완료율 계산
   */
  const completedCount = days.filter(d => d.isCompleted).length
  const completionRate = totalDays > 0 ? Math.round((completedCount / totalDays) * 100) : 0

  const beginEditTitle = () => {
    setTitleDraft(tracker?.title || '')
    setIsEditingTitle(true)
  }

  const cancelEditTitle = () => {
    setTitleDraft(tracker?.title || '')
    setIsEditingTitle(false)
  }

  const saveTitle = async () => {
    if (!tracker?.id) return
    const next = titleDraft.trim()
    if (!next) {
      showToast('습관 제목을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (next === (tracker.title || '').trim()) {
      setIsEditingTitle(false)
      return
    }
    try {
      setTitleSaving(true)
      await updateHabitTrackerTitle(tracker.id, next)
      setIsEditingTitle(false)
      onUpdate?.()
    } catch (error) {
      console.error('습관 제목 수정 실패:', error)
      showToast(error.message || '제목 수정에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setTitleSaving(false)
    }
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTitle()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditTitle()
    }
  }

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-5 hover:border-pink-300 transition-all duration-200">
      {/* 제목 바 */}
      <div 
        className="rounded-t-lg px-4 py-2 mb-4 pr-10"
        style={{ backgroundColor: tracker?.color || '#FFB6C1' }}
      >
        {isEditingTitle ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              disabled={titleSaving}
              className="min-w-0 flex-1 px-2 py-1 rounded border border-gray-400 text-base font-semibold text-gray-800 font-sans bg-white/95 focus:outline-none focus:ring-2 focus:ring-pink-500"
              aria-label="습관 제목"
            />
            <div className="flex shrink-0 gap-1 justify-end">
              <button
                type="button"
                onClick={cancelEditTitle}
                disabled={titleSaving}
                className="px-2 py-1 text-xs font-medium text-gray-700 bg-white/80 rounded border border-gray-400 hover:bg-white disabled:opacity-50 font-sans"
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveTitle}
                disabled={titleSaving}
                className="px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded hover:bg-gray-900 disabled:opacity-50 font-sans"
              >
                {titleSaving ? '저장…' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={beginEditTitle}
            aria-label="제목을 눌러 수정"
            className="w-full min-w-0 text-left text-lg font-semibold text-gray-800 font-sans break-words rounded-sm cursor-pointer hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-700 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            {tracker?.title || 'Habit Tracker'}
          </button>
        )}
      </div>

      {/* 바둑판 형태 달력 */}
      <div className="flex flex-col items-center mb-4">
        <div className="grid grid-cols-7 gap-1">
          {generateGridPattern(totalDays).map((row, rowIndex) => (
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

