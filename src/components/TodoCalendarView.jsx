import { MENU_ICON_PATHS } from '../constants/navigationMenu.js'
import TodoCalendar from './TodoCalendar.jsx'
import ViewPageTitle from './ViewPageTitle.jsx'

/**
 * 할 일 달력 화면 컴포넌트
 */
export default function TodoCalendarView() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <ViewPageTitle iconSrc={MENU_ICON_PATHS.todoCalendar} title="할 일 달력">
        <p className="text-xl text-gray-600">
          날짜별 완료한 할 일을 확인해보세요
        </p>
      </ViewPageTitle>
      <TodoCalendar />
    </div>
  )
}
