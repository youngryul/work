/**
 * Habit Tracker 컴포넌트
 * 트래커.png + 밭 위 미니 월 달력(7열) + 도장 포실이
 */
import { useState, useEffect, useRef } from 'react'
import { toggleHabitTrackerDay, updateHabitTrackerTitle } from '../../services/goalService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import {
  HABIT_TRACKER_BG_IMAGE,
  HABIT_TRACKER_POSILY_IMAGE,
  HABIT_TRACKER_SOIL_AREA,
  HABIT_TRACKER_TITLE_AREA,
  HABIT_TRACKER_WEEKDAYS,
  buildCalendarCells,
  getDaysInMonth,
  isFutureTrackerDay,
  isTodayTrackerDay,
  isSundayColumn,
  isSaturdayColumn,
} from '../../constants/habitTracker.js'

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
  const calendarCells = buildCalendarCells(year, month)

  useEffect(() => {
    if (tracker?.days) {
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

  const getDayStatus = (day) => {
    const dayData = days.find((d) => d.day === day)
    return dayData ? dayData.isCompleted : false
  }

  const handleDayClick = async (day) => {
    if (!tracker || isFutureTrackerDay(day, year, month)) return

    const currentStatus = getDayStatus(day)
    const newStatus = !currentStatus
    setAnimatingDay(day)

    try {
      const result = await toggleHabitTrackerDay(tracker.id, day, newStatus)

      const dayData = days.find((d) => d.day === day)
      if (dayData) {
        setDays(
          days.map((d) =>
            d.id === dayData.id
              ? {
                  ...d,
                  isCompleted: newStatus,
                  completedAt: newStatus ? new Date().toISOString() : null,
                }
              : d
          )
        )
      } else {
        setDays([
          ...days,
          {
            id: `temp-${day}`,
            habitTrackerId: tracker.id,
            day,
            isCompleted: newStatus,
            completedAt: newStatus ? new Date().toISOString() : null,
          },
        ])
      }

      setTimeout(() => setAnimatingDay(null), 420)
      if (newStatus && result?.jellyAwarded > 0) {
        showToast(`이 습관 오늘 첫 달성! 젤리 +${result.jellyAwarded}`, TOAST_TYPES.SUCCESS)
      }
      onUpdate?.()
    } catch (error) {
      console.error('Habit Tracker 업데이트 실패:', error)
      showToast('업데이트에 실패했습니다.', TOAST_TYPES.ERROR)
      setAnimatingDay(null)
    }
  }

  const completedCount = days.filter((d) => d.isCompleted).length
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
    <div className="w-full rounded-2xl border-2 border-amber-200/90 bg-gradient-to-b from-sky-50 to-amber-50/80 p-2 shadow-md hover:border-green-300 transition-all duration-200">
      <div className="relative mx-auto aspect-square w-full">
        <img
          src={HABIT_TRACKER_BG_IMAGE}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
          draggable={false}
        />

        {/* 습관 제목 — 이미지 점선 박스 */}
        <div
          className="absolute z-20 flex -translate-x-1/2 items-center justify-center text-center"
          style={{
            top: HABIT_TRACKER_TITLE_AREA.top,
            left: HABIT_TRACKER_TITLE_AREA.left,
            width: HABIT_TRACKER_TITLE_AREA.width,
            height: HABIT_TRACKER_TITLE_AREA.height,
          }}
        >
          {isEditingTitle ? (
            <div className="w-full rounded-lg border-2 border-amber-400/70 bg-white/95 px-2 py-1.5 shadow-md">
              <input
                ref={titleInputRef}
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                disabled={titleSaving}
                className="w-full border-b-2 border-amber-300 bg-transparent px-1 py-0.5 text-center text-base font-extrabold text-gray-900 focus:border-green-500 focus:outline-none font-sans sm:text-lg"
                aria-label="습관 제목"
                placeholder="습관 제목"
              />
              <div className="mt-1.5 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={cancelEditTitle}
                  disabled={titleSaving}
                  className="rounded-lg border border-amber-300 px-3 py-1 text-xs text-amber-900 hover:bg-amber-50 disabled:opacity-50 font-sans"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveTitle}
                  disabled={titleSaving}
                  className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 font-sans"
                >
                  {titleSaving ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={beginEditTitle}
              aria-label="제목을 눌러 수정"
              className="group flex h-full w-full items-center justify-center rounded-lg px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
            >
              <p className="line-clamp-2 w-full text-center text-base font-extrabold leading-snug text-gray-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.95),0_0_8px_rgba(255,255,255,0.75)] font-sans group-hover:underline sm:text-lg">
                {tracker?.title || '습관 제목을 눌러 입력'}
              </p>
            </button>
          )}
        </div>

        {/* 밭 위 미니 월 달력 */}
        <div
          className="absolute z-10 flex items-center justify-center px-1"
          style={{
            top: HABIT_TRACKER_SOIL_AREA.top,
            left: HABIT_TRACKER_SOIL_AREA.left,
            width: HABIT_TRACKER_SOIL_AREA.width,
            height: HABIT_TRACKER_SOIL_AREA.height,
          }}
        >
          <div className="w-full max-h-full rounded-md border border-amber-800/25 bg-[#fffaf0]/92 px-1.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            {/* 요일 헤더 */}
            <div className="mb-1 grid grid-cols-7 gap-0.5 rounded-sm bg-amber-900/10 px-0.5 py-0.5">
              {HABIT_TRACKER_WEEKDAYS.map((label, columnIndex) => (
                <span
                  key={label}
                  className={`
                    text-center text-[9px] font-extrabold leading-none font-sans sm:text-[10px]
                    [text-shadow:0_1px_0_rgba(255,255,255,0.9)]
                    ${isSundayColumn(columnIndex) ? 'text-red-600' : ''}
                    ${isSaturdayColumn(columnIndex) ? 'text-blue-600' : ''}
                    ${!isSundayColumn(columnIndex) && !isSaturdayColumn(columnIndex) ? 'text-amber-950' : ''}
                  `}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarCells.map((day, index) => {
                if (day === 0) {
                  return <div key={`empty-${index}`} className="aspect-square" aria-hidden="true" />
                }

                const columnIndex = index % 7
                const isCompleted = getDayStatus(day)
                const isAnimating = animatingDay === day
                const isFuture = isFutureTrackerDay(day, year, month)
                const isToday = isTodayTrackerDay(day, year, month)

                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    disabled={isFuture}
                    aria-label={`${day}일 ${isCompleted ? '달성됨' : '미달성'}`}
                    className={`
                      relative flex aspect-square flex-col items-center justify-center rounded-[3px]
                      border shadow-sm transition-all
                      ${isFuture
                        ? 'cursor-not-allowed border-amber-200/40 bg-white/35 opacity-45'
                        : 'cursor-pointer border-amber-300/80 bg-white/90 hover:bg-white active:scale-95'
                      }
                      ${isToday ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-[#fffaf0]' : ''}
                      ${isCompleted ? 'border-amber-500/70 bg-amber-50' : ''}
                    `}
                  >
                    {!isCompleted && (
                      <span
                        className={`
                          text-[9px] font-extrabold leading-none font-sans sm:text-[10px]
                          [text-shadow:0_1px_0_#ffffff,0_0_1px_rgba(0,0,0,0.15)]
                          ${isSundayColumn(columnIndex) ? 'text-red-600' : ''}
                          ${isSaturdayColumn(columnIndex) ? 'text-blue-600' : ''}
                          ${!isSundayColumn(columnIndex) && !isSaturdayColumn(columnIndex) ? 'text-gray-900' : ''}
                        `}
                      >
                        {day}
                      </span>
                    )}

                    {isCompleted && (
                      <img
                        src={HABIT_TRACKER_POSILY_IMAGE}
                        alt=""
                        className={`h-[78%] w-[78%] object-contain drop-shadow-sm ${isAnimating ? 'tracker-stamp' : ''}`}
                        draggable={false}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 완료율 */}
      <div className="mt-2 px-1 pb-0.5">
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-[10px] font-medium text-amber-900/80 font-sans">완료율</span>
          <span className="text-[10px] font-bold text-amber-950 font-sans">
            {completedCount}/{totalDays} ({completionRate}%)
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-amber-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-green-400 transition-all duration-300"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>
    </div>
  )
}
