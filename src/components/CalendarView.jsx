import { useState } from 'react'
import DiaryCalendar from './DiaryCalendar.jsx'
import DiaryForm from './DiaryForm.jsx'

/**
 * 일기 달력 화면 컴포넌트
 */
export default function CalendarView() {
  const [selectedDate, setSelectedDate] = useState(null)
  const [showDiaryForm, setShowDiaryForm] = useState(false)

  const handleDateClick = (dateString) => {
    setSelectedDate(dateString)
    setShowDiaryForm(true)
  }

  const handleSave = () => {
    setShowDiaryForm(false)
    setSelectedDate(null)
    // 달력 새로고침을 위해 페이지 리로드 또는 상태 업데이트
    window.location.reload()
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
          <div className="mb-8">
            <h1 className="text-6xl font-handwriting text-gray-800 mb-2">
              일기 달력
            </h1>
            <p className="text-3xl text-gray-600">
              날짜를 클릭하여 일기를 작성하고 AI 그림을 생성해보세요
            </p>
          </div>
          <DiaryCalendar onDateClick={handleDateClick} />
        </>
      )}
    </div>
  )
}


