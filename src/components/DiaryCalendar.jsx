import { useState, useEffect } from 'react'
import { getDiariesByMonth, getDiaryByDate } from '../services/diaryService.js'

/**
 * 일기 달력 컴포넌트
 * 각 날짜별로 일기 이미지를 표시
 */
export default function DiaryCalendar({ onDateClick }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [diaries, setDiaries] = useState({}) // { 'YYYY-MM-DD': { imageUrl, content } }
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedDiary, setSelectedDiary] = useState(null)
  const [imageErrors, setImageErrors] = useState({}) // { 'YYYY-MM-DD': true } - 이미지 로드 실패한 날짜들

  /**
   * 일기 로드
   */
  const loadDiaries = async () => {
    setIsLoading(true)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      
      // 일기 로드
      const diaryList = await getDiariesByMonth(year, month)
      const diaryMap = {}
      diaryList.forEach(diary => {
        diaryMap[diary.date] = diary
      })
      setDiaries(diaryMap)
    } catch (error) {
      console.error('일기 로드 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDiaries()
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
   * 날짜 클릭 시 처리
   */
  const handleDateClick = async (dateString) => {
    // 일기 작성/수정을 위한 콜백 호출
    if (onDateClick) {
      onDateClick(dateString)
      return
    }
    
    // 일기 상세 보기
    const diary = diaries[dateString]
    if (diary) {
      try {
        const fullDiary = await getDiaryByDate(dateString)
        setSelectedDiary(fullDiary)
        setSelectedDate(dateString)
      } catch (error) {
        console.error('일기 조회 오류:', error)
      }
    } else {
      // 일기가 없으면 작성 폼 열기
      if (onDateClick) {
        onDateClick(dateString)
      }
    }
  }

  /**
   * 팝업 닫기
   */
  const handleClosePopup = () => {
    setSelectedDate(null)
    setSelectedDiary(null)
  }

  /**
   * 날짜 포맷팅
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
      const isToday =
        year === new Date().getFullYear() &&
        month === new Date().getMonth() &&
        day === new Date().getDate()

      const diary = diaries[dateString]
      const hasDiary = !!diary
      const hasImage = !!diary?.imageUrl && !imageErrors[dateString]
      const imageLoadFailed = imageErrors[dateString]

      days.push(
        <div
          key={day}
          onClick={() => handleDateClick(dateString)}
          className={`aspect-square flex flex-col items-start justify-start p-1 rounded-lg transition-all duration-200 relative overflow-hidden cursor-pointer hover:shadow-md ${
            isToday
              ? 'bg-green-200 border-2 border-green-400'
              : 'bg-gray-50 hover:bg-gray-100'
          }`}
        >
          {/* 날짜 번호 */}
          <span
            className={`text-xs font-medium z-10 ${
              isToday ? 'text-green-700' : 'text-gray-700'
            }`}
          >
            {day}
          </span>
          
          {/* 일기 이미지 */}
          {hasImage && (
            <img
              src={diary.imageUrl}
              alt="일기 이미지"
              className="absolute inset-0 w-full h-full object-cover opacity-80"
              onError={() => {
                // 이미지 로드 실패 시 에러 상태 업데이트
                setImageErrors(prev => ({ ...prev, [dateString]: true }))
              }}
            />
          )}
          
          {/* 일기 작성 표시 (이미지가 없거나 로드 실패한 경우) */}
          {hasDiary && (!hasImage || imageLoadFailed) && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">🖼️</span>
                <span className="text-[10px] text-gray-600 font-medium">일기 이미지</span>
              </div>
            </div>
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

      {/* 일기 상세 팝업 */}
      {selectedDate && selectedDiary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            {/* 팝업 헤더 */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-3xl font-handwriting text-gray-800">
                  {formatDateForPopup(selectedDate)}
                </h3>
              </div>
              <button
                onClick={handleClosePopup}
                className="text-gray-400 hover:text-gray-600 text-4xl leading-none"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            {/* 일기 내용 */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* AI 생성 이미지 */}
              {selectedDiary.imageUrl && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-600 mb-2 font-sans">AI 생성 이미지</h4>
                  <img
                    src={selectedDiary.imageUrl}
                    alt="일기 이미지"
                    className="w-full rounded-lg border-2 border-green-200"
                  />
                </div>
              )}
              
              {/* 첨부된 사진 */}
              {selectedDiary.attachedImages && selectedDiary.attachedImages.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-600 mb-2 font-sans">
                    첨부된 사진 ({selectedDiary.attachedImages.length}개)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedDiary.attachedImages.map((imageUrl, index) => (
                      <img
                        key={index}
                        src={imageUrl}
                        alt={`첨부 이미지 ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* 일기 내용 */}
              <div className="text-lg text-gray-700 whitespace-pre-wrap font-sans">
                {selectedDiary.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
