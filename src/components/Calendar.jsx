import { useState, useEffect } from 'react'
import { getCompletedCountsByDate, getCompletedTasksByDate } from '../services/taskService.js'

/**
 * 달력 컴포넌트
 * 각 날짜별로 완료된 할 일 개수를 표시
 */
export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [completedCounts, setCompletedCounts] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [completedTasks, setCompletedTasks] = useState([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)

  /**
   * 완료 개수 로드
   */
  const loadCompletedCounts = async () => {
    setIsLoading(true)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      const counts = await getCompletedCountsByDate(year, month)
      setCompletedCounts(counts)
    } catch (error) {
      console.error('완료 개수 로드 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCompletedCounts()
  }, [currentDate])

  /**
   * 이전 달로 이동
   */
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  /**
   * 다음 달로 이동
   */
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  /**
   * 오늘로 이동
   */
  const handleToday = () => {
    setCurrentDate(new Date())
  }

  /**
   * 날짜 클릭 시 완료된 할 일 목록 조회
   */
  const handleDateClick = async (dateString) => {
    const count = completedCounts[dateString] || 0
    if (count === 0) return

    setSelectedDate(dateString)
    setIsLoadingTasks(true)
    try {
      const tasks = await getCompletedTasksByDate(dateString)
      setCompletedTasks(tasks)
    } catch (error) {
      console.error('완료된 할 일 로드 오류:', error)
    } finally {
      setIsLoadingTasks(false)
    }
  }

  /**
   * 팝업 닫기
   */
  const handleClosePopup = () => {
    setSelectedDate(null)
    setCompletedTasks([])
  }

  /**
   * 날짜 포맷팅 (팝업 제목용)
   */
  const formatDateForPopup = (dateString) => {
    const [year, month, day] = dateString.split('-')
    const date = new Date(year, month - 1, day)
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const weekday = weekdays[date.getDay()]
    return `${year}년 ${month}월 ${day}일 (${weekday})`
  }

  /**
   * 달력 그리드 생성
   */
  const generateCalendar = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // 해당 월의 첫 날과 마지막 날
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const calendar = []
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']

    // 요일 헤더
    calendar.push(
      <div key="header" className="grid grid-cols-7 gap-1 mb-2">
        {weekdays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-semibold text-gray-600 py-2"
          >
            {day}
          </div>
        ))}
      </div>
    )

    // 날짜 그리드
    const days = []
    let currentDay = 1

    // 첫 주의 빈 칸
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />)
    }

    // 날짜 칸
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const count = completedCounts[dateString] || 0
      const isToday =
        year === new Date().getFullYear() &&
        month === new Date().getMonth() &&
        day === new Date().getDate()

      days.push(
        <div
          key={day}
          onClick={() => count > 0 && handleDateClick(dateString)}
          className={`aspect-square flex flex-col items-start justify-start p-2 rounded-lg transition-all duration-200 relative ${
            isToday
              ? 'bg-pink-200 border-2 border-pink-400'
              : 'bg-gray-50 hover:bg-gray-100'
          } ${count > 0 ? 'cursor-pointer hover:shadow-md' : ''}`}
        >
          <span
            className={`text-sm font-medium ${
              isToday ? 'text-pink-700' : 'text-gray-700'
            }`}
          >
            {day}
          </span>
          {count > 0 && (
            <span
              className={`text-lg font-bold mt-auto mx-auto ${
                isToday ? 'text-pink-600' : 'text-pink-500'
              }`}
            >
              {count}개
            </span>
          )}
        </div>
      )
    }

    // 마지막 주의 빈 칸
    const remainingCells = 7 - (days.length % 7)
    if (remainingCells < 7) {
      for (let i = 0; i < remainingCells; i++) {
        days.push(<div key={`empty-end-${i}`} className="aspect-square" />)
      }
    }

    calendar.push(
      <div key="days" className="grid grid-cols-7 gap-1">
        {days}
      </div>
    )

    return calendar
  }

  /**
   * 월/년도 표시 문자열
   */
  const getMonthYearString = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    return `${year}년 ${month}월`
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePrevMonth}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-xl"
          aria-label="이전 달"
        >
          ‹
        </button>
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-handwriting text-gray-800">
            {getMonthYearString()}
          </h2>
          <button
            onClick={handleToday}
            className="px-3 py-1 text-sm bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 transition-colors duration-200"
          >
            오늘
          </button>
        </div>
        <button
          onClick={handleNextMonth}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-xl"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>

      {/* 달력 */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">로딩 중...</div>
      ) : (
        generateCalendar()
      )}

      {/* 완료된 할 일 팝업 */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* 팝업 헤더 */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-3xl font-handwriting text-gray-800">
                  {formatDateForPopup(selectedDate)}
                </h3>
                <p className="text-xl text-gray-600 mt-1">
                  완료한 할 일 {completedTasks.length}개
                </p>
              </div>
              <button
                onClick={handleClosePopup}
                className="text-gray-400 hover:text-gray-600 text-4xl leading-none"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            {/* 완료된 할 일 목록 */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingTasks ? (
                <div className="text-center py-8 text-gray-500">로딩 중...</div>
              ) : completedTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  완료된 할 일이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-4 bg-pink-50 rounded-lg border border-pink-200"
                    >
                      <div className="flex-shrink-0 w-6 h-6 bg-pink-400 rounded-full flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <span className="text-lg text-gray-800">
                        {task.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
