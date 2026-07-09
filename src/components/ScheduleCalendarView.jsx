import ScheduleCalendar from './ScheduleCalendar.jsx'

/**
 * 일정 달력 화면 컴포넌트
 */
export default function ScheduleCalendarView() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-handwriting text-gray-800 mb-2">일정 달력</h1>
        <p className="text-xl text-gray-600">
          일정 추가·삭제와 생리 일정을 한 달력에서 관리하세요
        </p>
      </div>
      <ScheduleCalendar />
    </div>
  )
}
