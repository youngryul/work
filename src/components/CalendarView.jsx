import { useState, useEffect } from 'react'
import { MENU_ICON_PATHS } from '../constants/navigationMenu.js'
import { useAiTokenInfo } from '../hooks/useAiTokenInfo.js'
import AiTokenGenerationCostNote from './AiTokenGenerationCostNote.jsx'
import DiaryCalendar from './DiaryCalendar.jsx'
import DiaryForm from './DiaryForm.jsx'
import ViewPageTitle from './ViewPageTitle.jsx'
import { getPastDiaryDates } from '../services/diaryService.js'
import { pickRandomDiaryDate, toLocalDateString } from '../utils/diaryMemory.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * YYYY-MM-DD → "2025년 10월 19일 (일)"
 * @param {string} dateString
 */
function formatDiaryDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

/**
 * 일기 달력 화면 컴포넌트
 * @param {{
 *   calendarKey: number,
 *   onCalendarKeyChange: (value: number | ((prev: number) => number)) => void,
 *   onOpenDepositModal: () => void,
 *   initialOpenDate?: string | null,
 * }} props
 */
export default function CalendarView({
  calendarKey,
  onCalendarKeyChange,
  onOpenDepositModal,
  initialOpenDate = null,
}) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [showDiaryForm, setShowDiaryForm] = useState(false)
  /** 달력에 표시할 날짜 (작성한 날짜의 달을 유지) */
  const [calendarFocusDate, setCalendarFocusDate] = useState(null)
  const { generationCost } = useAiTokenInfo(calendarKey)
  /** 랜덤으로 연 일기인지 (상단에 '다른 날 보기' 표시) */
  const [isRandomMode, setIsRandomMode] = useState(false)
  const [isPicking, setIsPicking] = useState(false)

  useEffect(() => {
    if (!initialOpenDate) return
    setSelectedDate(initialOpenDate)
    setCalendarFocusDate(initialOpenDate)
    setShowDiaryForm(true)
  }, [initialOpenDate])

  const rememberDate = (dateString) => {
    setSelectedDate(dateString)
    setCalendarFocusDate(dateString)
  }

  const handleDateClick = (dateString) => {
    rememberDate(dateString)
    setShowDiaryForm(true)
    setIsRandomMode(false)
  }

  /** 과거 일기 하나를 랜덤으로 열기 */
  const handleOpenRandomDiary = async () => {
    setIsPicking(true)
    try {
      const dates = await getPastDiaryDates(toLocalDateString(new Date()))
      const picked = pickRandomDiaryDate(dates, isRandomMode ? selectedDate : null)
      if (!picked) {
        showToast('아직 지난 일기가 없어요. 오늘 일기부터 써 볼까요?', TOAST_TYPES.INFO)
        return
      }
      rememberDate(picked)
      setShowDiaryForm(true)
      setIsRandomMode(true)
    } catch (error) {
      showToast(error?.message || '지난 일기를 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsPicking(false)
    }
  }

  const handleSave = () => {
    setShowDiaryForm(false)
    setSelectedDate(null)
    setIsRandomMode(false)
    onCalendarKeyChange((prev) => prev + 1)
  }

  const handleCancel = () => {
    setShowDiaryForm(false)
    setSelectedDate(null)
    setIsRandomMode(false)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {showDiaryForm ? (
        <>
        {isRandomMode && selectedDate && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 font-sans">
            <p className="text-sm text-amber-900">
              🎲 <span className="font-semibold">{formatDiaryDate(selectedDate)}</span>의 일기를 꺼내 왔어요
            </p>
            <button
              type="button"
              onClick={handleOpenRandomDiary}
              disabled={isPicking}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
            >
              {isPicking ? '고르는 중...' : '🎲 다른 날 보기'}
            </button>
          </div>
        )}
        <DiaryForm
          selectedDate={selectedDate}
          onDateChange={rememberDate}
          onSave={handleSave}
          onCancel={handleCancel}
          embedded
          tokenRefreshDep={calendarKey}
          onOpenDepositModal={onOpenDepositModal}
        />
        </>
      ) : (
        <>
          <ViewPageTitle iconSrc={MENU_ICON_PATHS.diaryCalendar} title="일기 달력">
            <p className="text-xl text-gray-600">
              날짜를 선택해 글을 쓴 뒤, 글만 저장하거나 AI 4컷을 만들어 보세요
            </p>
            <AiTokenGenerationCostNote cost={generationCost} className="mt-2" />
            <button
              type="button"
              onClick={handleOpenRandomDiary}
              disabled={isPicking}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-800 text-base font-semibold hover:bg-amber-100 disabled:opacity-50 font-sans"
            >
              🎲 {isPicking ? '지난 일기 고르는 중...' : '그날의 일기 꺼내 보기'}
            </button>
          </ViewPageTitle>
          <DiaryCalendar
            key={calendarKey}
            initialDate={calendarFocusDate}
            onDateClick={handleDateClick}
          />
        </>
      )}
    </div>
  )
}
