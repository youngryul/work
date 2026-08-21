import { useState, useEffect } from 'react'
import {
  getDiariesByMonth,
  getDiaryByDate,
  getDiaryCoverCandidates,
  getDiaryThumbUrl,
  updateDiaryCoverImage,
} from '../services/diaryService.js'
import DiaryShareButton from './DiaryShareButton.jsx'
import FourCutDispenserModal from './FourCutDispenserModal.jsx'
import { getDiaryEmotionLabel } from '../constants/diaryEmotions.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * YYYY-MM-DD → 해당 날짜의 Date (로컬)
 * @param {string} dateString
 * @returns {Date}
 */
function dateFromString(dateString) {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Date → YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
function toDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * 일기 달력 컴포넌트
 * 각 날짜별로 일기 이미지를 표시
 * @param {{
 *   onDateClick?: (dateString: string) => void,
 *   initialDate?: string | null,
 * }} props
 */
export default function DiaryCalendar({ onDateClick, initialDate = null }) {
  const [currentDate, setCurrentDate] = useState(() => (
    initialDate ? dateFromString(initialDate) : new Date()
  ))
  const [diaries, setDiaries] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedDiary, setSelectedDiary] = useState(null)
  const [focusedDate, setFocusedDate] = useState(initialDate || null)
  const [imageErrors, setImageErrors] = useState({})
  const [showFourCutModal, setShowFourCutModal] = useState(false)
  const [isUpdatingCover, setIsUpdatingCover] = useState(false)

  const getThumbUrl = (diary) => getDiaryThumbUrl(diary)

  const loadDiaries = async () => {
    setIsLoading(true)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      const diaryList = await getDiariesByMonth(year, month)
      const diaryMap = {}
      diaryList.forEach((diary) => {
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

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setFocusedDate(toDateString(today))
  }

  const handleJumpDate = (dateString) => {
    if (!dateString) return
    setCurrentDate(dateFromString(dateString))
    setFocusedDate(dateString)
  }

  const handleDateClick = async (dateString) => {
    setFocusedDate(dateString)

    if (onDateClick) {
      onDateClick(dateString)
      return
    }

    const diary = diaries[dateString]
    if (!diary) return

    try {
      const fullDiary = await getDiaryByDate(dateString)
      setSelectedDiary(fullDiary)
      setSelectedDate(dateString)
    } catch (error) {
      console.error('일기 조회 오류:', error)
    }
  }

  const handleClosePopup = () => {
    setSelectedDate(null)
    setSelectedDiary(null)
  }

  const handleSelectCover = async (imageUrl) => {
    if (!selectedDate || !imageUrl || isUpdatingCover) return
    if (selectedDiary?.coverImageUrl === imageUrl) return

    setIsUpdatingCover(true)
    try {
      const updated = await updateDiaryCoverImage(selectedDate, imageUrl)
      setSelectedDiary(updated)
      setDiaries((prev) => ({
        ...prev,
        [selectedDate]: { ...prev[selectedDate], ...updated },
      }))
      setImageErrors((prev) => {
        const next = { ...prev }
        delete next[selectedDate]
        return next
      })
      showToast('달력 대문 이미지를 변경했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('대문 이미지 변경 실패:', error)
      showToast(error.message || '대문 이미지 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsUpdatingCover(false)
    }
  }

  const formatDateForPopup = (dateString) => {
    const date = new Date(dateString + 'T00:00:00')
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`
  }

  const generateCalendar = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = new Date()
    const calendar = []

    const weekDays = ['일', '월', '화', '수', '목', '금', '토']
    calendar.push(
      <div key="weekdays" className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
            {day}
          </div>
        ))}
      </div>,
    )

    const days = []
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const diary = diaries[dateString]
      const hasDiary = !!diary
      const thumbUrl = getThumbUrl(diary)
      const hasImage = !!thumbUrl && !imageErrors[dateString]
      const imageLoadFailed = !!imageErrors[dateString]
      const isToday =
        today.getFullYear() === year
        && today.getMonth() === month
        && today.getDate() === day
      const isFocused = focusedDate === dateString

      days.push(
        <div
          key={day}
          onClick={() => handleDateClick(dateString)}
          className={`aspect-square flex flex-col items-start justify-start p-1 rounded-lg transition-all duration-200 relative overflow-hidden cursor-pointer hover:shadow-md ${
            isFocused
              ? 'bg-green-200 border-2 border-green-400'
              : isToday
                ? 'bg-green-50 border-2 border-green-300'
                : 'bg-gray-50 hover:bg-gray-100'
          }`}
        >
          <span
            className={`text-xs font-medium z-10 ${
              isFocused || isToday ? 'text-green-700' : 'text-gray-700'
            }`}
          >
            {day}
          </span>

          {hasImage && (
            <img
              src={thumbUrl}
              alt="일기 이미지"
              className="absolute inset-0 w-full h-full object-cover object-center opacity-80"
              onError={() => {
                setImageErrors((prev) => ({ ...prev, [dateString]: true }))
              }}
            />
          )}

          {hasDiary && (!hasImage || imageLoadFailed) && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">🖼️</span>
                <span className="text-[10px] text-gray-600 font-medium">일기 이미지</span>
              </div>
            </div>
          )}
        </div>,
      )
    }

    const remainingCells = 7 - (days.length % 7)
    if (remainingCells < 7) {
      for (let i = 0; i < remainingCells; i++) {
        days.push(<div key={`empty-end-${i}`} className="aspect-square" />)
      }
    }

    calendar.push(
      <div key="days" className="grid grid-cols-7 gap-1">
        {days}
      </div>,
    )

    return calendar
  }

  const getMonthYearString = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    return `${year}년 ${month}월`
  }

  const coverCandidates = selectedDiary ? getDiaryCoverCandidates(selectedDiary) : []
  const currentCover =
    selectedDiary?.coverImageUrl
    || getDiaryThumbUrl(selectedDiary)
    || null

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePrevMonth}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-xl"
          aria-label="이전 달"
        >
          ‹
        </button>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <h2 className="text-2xl font-handwriting text-gray-800">
            {getMonthYearString()}
          </h2>
          <input
            type="date"
            value={focusedDate || toDateString(currentDate)}
            onChange={(e) => handleJumpDate(e.target.value)}
            className="px-3 py-1 text-sm border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400 font-sans"
            aria-label="날짜 선택"
          />
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

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">로딩 중...</div>
      ) : (
        generateCalendar()
      )}

      {selectedDate && selectedDiary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b gap-3">
              <div>
                <h3 className="text-3xl font-handwriting text-gray-800">
                  {formatDateForPopup(selectedDate)}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(currentCover || selectedDiary.imageUrl) && (
                  <DiaryShareButton
                    imageUrl={currentCover || selectedDiary.imageUrl}
                    dateString={selectedDate}
                    emotionLabel={getDiaryEmotionLabel(selectedDiary.emotion)}
                    size="sm"
                  />
                )}
                <button
                  onClick={handleClosePopup}
                  className="text-gray-400 hover:text-gray-600 text-4xl leading-none"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {coverCandidates.length > 0 && (
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-gray-600 font-sans">
                      대문 이미지 선택 ({coverCandidates.length}장)
                    </h4>
                    {selectedDiary.fourCutUrl && (
                      <button
                        type="button"
                        onClick={() => setShowFourCutModal(true)}
                        className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700"
                      >
                        4컷 보기
                      </button>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-gray-500 font-sans">
                    달력에 보일 대표 사진을 골라 주세요. (장면 + 4컷 스트립 포함)
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {coverCandidates.map((url, index) => {
                      const isSelected = currentCover === url
                      const isStrip = url === selectedDiary.fourCutUrl
                      return (
                        <button
                          key={`${url}-${index}`}
                          type="button"
                          disabled={isUpdatingCover}
                          onClick={() => handleSelectCover(url)}
                          className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-green-500 ring-2 ring-green-300'
                              : 'border-gray-200 hover:border-green-300'
                          } disabled:opacity-60`}
                        >
                          <img
                            src={url}
                            alt={isStrip ? '4컷 스트립' : `후보 ${index + 1}`}
                            className={`w-full ${isStrip ? 'h-28 object-contain bg-white' : 'h-24 object-cover'}`}
                          />
                          {isSelected && (
                            <span className="absolute bottom-1 left-1 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              대문
                            </span>
                          )}
                          {isStrip && !isSelected && (
                            <span className="absolute bottom-1 left-1 rounded bg-stone-700/80 px-1.5 py-0.5 text-[10px] text-white">
                              4컷
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {selectedDiary.imageUrl && coverCandidates.length === 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-600 mb-2 font-sans">AI 생성 이미지</h4>
                  <img
                    src={selectedDiary.imageUrl}
                    alt="일기 이미지"
                    className="w-full rounded-lg border-2 border-green-200"
                  />
                </div>
              )}

              <div className="text-lg text-gray-700 whitespace-pre-wrap font-sans">
                {selectedDiary.content}
              </div>
            </div>
          </div>
        </div>
      )}

      <FourCutDispenserModal
        isOpen={showFourCutModal}
        sceneUrls={selectedDiary?.fourCutSceneUrls || selectedDiary?.attachedImages || []}
        fourCutUrl={selectedDiary?.fourCutUrl || null}
        dateLabel={selectedDate || ''}
        onClose={() => setShowFourCutModal(false)}
      />
    </div>
  )
}
