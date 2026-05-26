import { useState } from 'react'
import { MENU_ICON_PATHS } from '../constants/navigationMenu.js'
import DiaryCalendar from './DiaryCalendar.jsx'
import DiaryForm from './DiaryForm.jsx'
import ViewPageTitle from './ViewPageTitle.jsx'

/**
 * 일기 달력 화면 컴포넌트
 */
export default function CalendarView() {
  const [selectedDate, setSelectedDate] = useState(null)
  const [showDiaryForm, setShowDiaryForm] = useState(false)
  const [calendarKey, setCalendarKey] = useState(0) // 달력 새로고침을 위한 key

  const handleDateClick = (dateString) => {
    setSelectedDate(dateString)
    setShowDiaryForm(true)
  }

  const handleSave = () => {
    setShowDiaryForm(false)
    setSelectedDate(null)
    // 달력 새로고침을 위해 key 변경 (페이지 리로드 없이)
    setCalendarKey(prev => prev + 1)
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
        />
      ) : (
        <>
          <ViewPageTitle iconSrc={MENU_ICON_PATHS.diaryCalendar} title="일기 달력">
            <p className="text-xl text-gray-600">
              날짜를 클릭하여 일기를 작성하고 AI 그림을 생성해보세요
            </p>
          </ViewPageTitle>
          <DiaryCalendar key={calendarKey} onDateClick={handleDateClick} />
        </>
      )}
    </div>
  )
}


