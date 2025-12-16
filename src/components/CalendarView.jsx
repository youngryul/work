import Calendar from './Calendar.jsx'

/**
 * 달력 화면 컴포넌트
 */
export default function CalendarView() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-6xl font-handwriting text-gray-800 mb-2">
          달력
        </h1>
        <p className="text-3xl text-gray-600">
          날짜별 완료한 할 일을 확인해보세요
        </p>
      </div>
      <Calendar />
    </div>
  )
}
