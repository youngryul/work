import { useState, useEffect } from 'react'
import { getCompletedCountsByDate, getCompletedTasksByDate, restoreCompletedTaskToToday } from '../services/taskService.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'
// 주간 업무일지만 사용하므로 일일 업무일지 생성 기능 제거
// import { generateDailyWorkReport, saveWorkReport, getWorkReport, getWorkReportDatesByMonth } from '../services/workReportService.js'

/**
 * 할 일 달력 컴포넌트
 * 각 날짜별로 완료된 할 일 개수를 표시
 */
export default function TodoCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [completedCounts, setCompletedCounts] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [completedTasks, setCompletedTasks] = useState([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  // 주간 업무일지만 사용하므로 일일 업무일지 관련 상태 제거
  // const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  // const [workReport, setWorkReport] = useState(null)
  // const [workReportDates, setWorkReportDates] = useState([]) // 업무일지가 있는 날짜들

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

  // 주간 업무일지만 사용하므로 일일 업무일지 날짜 로드 제거
  // const loadWorkReportDates = async () => {
  //   try {
  //     const year = currentDate.getFullYear()
  //     const month = currentDate.getMonth() + 1
  //     const dates = await getWorkReportDatesByMonth(year, month)
  //     setWorkReportDates(dates)
  //   } catch (error) {
  //     console.error('업무일지 날짜 로드 오류:', error)
  //   }
  // }

  useEffect(() => {
    loadCompletedCounts()
    // loadWorkReportDates() // 주간 업무일지만 사용
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
    // setWorkReport(null) // 주간 업무일지만 사용
    try {
      const tasks = await getCompletedTasksByDate(dateString)
      setCompletedTasks(tasks)
      // 주간 업무일지만 사용하므로 일일 업무일지 로드 제거
      // const existingReport = await getWorkReport(dateString)
      // setWorkReport(existingReport)
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
    // setWorkReport(null) // 주간 업무일지만 사용
  }

  /**
   * 선택된 날짜가 오늘인지 확인
   */
  const isTodayDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number)
    const selectedDateObj = new Date(year, month - 1, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    selectedDateObj.setHours(0, 0, 0, 0)
    return selectedDateObj.getTime() === today.getTime()
  }

  /**
   * 완료된 할 일을 오늘 할 일로 복구
   */
  const handleRestoreToToday = async (taskId) => {
    try {
      await restoreCompletedTaskToToday(taskId)
      // 팝업 닫기
      handleClosePopup()
      // 오늘 할일 화면으로 이동
      if (window.setCurrentView) {
        window.setCurrentView('today')
      }
      // 완료 개수 새로고침
      await loadCompletedCounts()
      // 오늘 할일 목록 새로고침 이벤트 발생
      window.dispatchEvent(new CustomEvent('refreshTodayTasks'))
    } catch (error) {
      console.error('복구 오류:', error)
      showToast(error.message || '복구에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  // 주간 업무일지만 사용하므로 일일 업무일지 생성 함수 제거
  // const handleGenerateWorkReport = async () => {
  //   if (!selectedDate || completedTasks.length === 0) return
  //
  //   setIsGeneratingReport(true)
  //   try {
  //     const report = await generateDailyWorkReport(completedTasks, selectedDate)
  //     setWorkReport(report)
  //     // DB에 저장
  //     await saveWorkReport(selectedDate, report)
  //     // 달력 도장 표시를 위해 날짜 목록 업데이트
  //     await loadWorkReportDates()
  //   } catch (error) {
  //     console.error('업무일지 생성 오류:', error)
  //     showToast(error.message || '업무일지 생성에 실패했습니다.', TOAST_TYPES.ERROR)
  //   } finally {
  //     setIsGeneratingReport(false)
  //   }
  // }

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

    // 첫 주의 빈 칸
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />)
    }

    // 날짜 칸
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const count = completedCounts[dateString] || 0
      // 주간 업무일지만 사용하므로 일일 업무일지 도장 표시 제거
      // const hasWorkReport = workReportDates.includes(dateString)
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
              ? 'bg-green-200 border-2 border-green-400'
              : 'bg-gray-50 hover:bg-gray-100'
          } ${count > 0 ? 'cursor-pointer hover:shadow-md' : ''}`}
        >
          <span
            className={`text-sm font-medium ${
              isToday ? 'text-green-700' : 'text-gray-700'
            }`}
          >
            {day}
          </span>
          {count > 0 && (
            <span
              className={`text-lg font-bold mt-auto mx-auto ${
                isToday ? 'text-green-600' : 'text-green-500'
              }`}
            >
              {count}개
            </span>
          )}
          {/* 주간 업무일지만 사용하므로 일일 업무일지 도장 표시 제거 */}
          {/* {hasWorkReport && (
            <div className="absolute top-1 right-1">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-md border-2 border-white">
                <span className="text-white text-lg font-bold">✓</span>
              </div>
            </div>
          )} */}
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
            className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors duration-200"
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
              <div className="flex-1">
                <h3 className="text-3xl font-handwriting text-gray-800">
                  {formatDateForPopup(selectedDate)}
                </h3>
                <p className="text-xl text-gray-600 mt-1">
                  완료한 할 일 {completedTasks.length}개
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClosePopup}
                  className="text-gray-400 hover:text-gray-600 text-4xl leading-none"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
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
                      className="flex items-center justify-between gap-3 p-4 bg-green-50 rounded-lg border border-green-200"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-shrink-0 w-6 h-6 bg-green-400 rounded-full flex items-center justify-center">
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
                      {isTodayDate(selectedDate) && (
                        <button
                          onClick={() => handleRestoreToToday(task.id)}
                          className="px-4 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors duration-200 text-sm font-semibold whitespace-nowrap"
                        >
                          오늘 할일로 복구
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 주간 업무일지만 사용하므로 일일 업무일지 표시 제거 */}
              {/* {workReport && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xl font-semibold text-gray-800">📝 업무일지</h4>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(workReport)
                        showToast('업무일지가 클립보드에 복사되었습니다!', TOAST_TYPES.SUCCESS)
                      }}
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                    >
                      📋 복사
                    </button>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-800 font-sans leading-relaxed max-h-96 overflow-y-auto">
                    <ReactMarkdown
                      components={{
                        h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-3 text-gray-900" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-4 mb-2 text-gray-900" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-3 mb-2 text-gray-800" {...props} />,
                        p: ({ node, ...props }) => <p className="mb-2 text-gray-700 text-sm" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-700 text-sm" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-700 text-sm" {...props} />,
                        li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
                        em: ({ node, ...props }) => <em className="italic" {...props} />,
                      }}
                    >
                      {workReport}
                    </ReactMarkdown>
                  </div>
                </div>
              )} */}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
