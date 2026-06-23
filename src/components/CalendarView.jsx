import { useState, useEffect } from 'react'
import { MENU_ICON_PATHS } from '../constants/navigationMenu.js'
import { useAiTokenInfo } from '../hooks/useAiTokenInfo.js'
import AiTokenGenerationCostNote from './AiTokenGenerationCostNote.jsx'
import DiaryCalendar from './DiaryCalendar.jsx'
import DiaryForm from './DiaryForm.jsx'
import ViewPageTitle from './ViewPageTitle.jsx'

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
  const { generationCost } = useAiTokenInfo(calendarKey)

  useEffect(() => {
    if (!initialOpenDate) return
    setSelectedDate(initialOpenDate)
    setShowDiaryForm(true)
  }, [initialOpenDate])

  const handleDateClick = (dateString) => {
    setSelectedDate(dateString)
    setShowDiaryForm(true)
  }

  const handleSave = () => {
    setShowDiaryForm(false)
    setSelectedDate(null)
    onCalendarKeyChange((prev) => prev + 1)
  }

  const handleCancel = () => {
    setShowDiaryForm(false)
    setSelectedDate(null)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {showDiaryForm ? (
        <DiaryForm
          selectedDate={selectedDate}
          onSave={handleSave}
          onCancel={handleCancel}
          embedded
          tokenRefreshDep={calendarKey}
          onOpenDepositModal={onOpenDepositModal}
        />
      ) : (
        <>
          <ViewPageTitle iconSrc={MENU_ICON_PATHS.diaryCalendar} title="일기 달력">
            <p className="text-xl text-gray-600">
              날짜를 클릭하여 일기를 작성하고 AI 그림을 생성해보세요
            </p>
            <AiTokenGenerationCostNote cost={generationCost} className="mt-2" />
          </ViewPageTitle>
          <DiaryCalendar key={calendarKey} onDateClick={handleDateClick} />
        </>
      )}
    </div>
  )
}
