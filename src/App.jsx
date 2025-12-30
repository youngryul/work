import { useState } from 'react'
import TodayView from './components/TodayView.jsx'
import BacklogView from './components/BacklogView.jsx'
import TodoCalendarView from './components/TodoCalendarView.jsx'
import CalendarView from './components/CalendarView.jsx'
import AnnualReviewView from './components/AnnualReviewView.jsx'
import RecordMainView from './components/RecordMainView.jsx'
import RecordForm from './components/RecordForm.jsx'
import GoalsDashboard from './components/goals/GoalsDashboard.jsx'
import BucketlistView from './components/bucketlist/BucketlistView.jsx'
import ReadingView from './components/reading/ReadingView.jsx'
import NavigationSidebar from './components/NavigationSidebar.jsx'

/**
 * 메인 앱 컴포넌트
 */
function App() {
  const [currentView, setCurrentView] = useState('today')
  const [recordView, setRecordView] = useState('main') // 'main' | 'form'
  const [editingRecord, setEditingRecord] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false) // 모바일 사이드바 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false) // 데스크톱 사이드바 접힘 상태

  // 새 기록 작성
  const handleNewRecord = () => {
    setEditingRecord(null)
    setRecordView('form')
  }

  // 기록 수정
  const handleEditRecord = (record) => {
    setEditingRecord(record)
    setRecordView('form')
  }

  // 저장 완료
  const handleSaveComplete = () => {
    setRecordView('main')
    setEditingRecord(null)
  }

  // 취소
  const handleCancel = () => {
    setRecordView('main')
    setEditingRecord(null)
  }

  return (
    <div className="min-h-screen flex">
      {/* 사이드바 네비게이션 */}
      <NavigationSidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* 메인 컨텐츠 영역 */}
      <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        {/* 모바일 헤더 (햄버거 메뉴) */}
        <header className="md:hidden bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-30">
          <div className="px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-600 hover:text-gray-800 text-2xl"
            >
              ☰
            </button>
          </div>
        </header>

        {/* 메인 컨텐츠 */}
        <main className="py-8">
        {currentView === 'today' && <TodayView />}
        {currentView === 'backlog' && <BacklogView />}
        {currentView === 'todo-calendar' && <TodoCalendarView />}
        {currentView === 'diary-calendar' && <CalendarView />}
        {currentView === 'review' && <AnnualReviewView />}
        {currentView === 'records' && (
          <>
            {recordView === 'main' && (
              <RecordMainView
                onNewRecord={handleNewRecord}
                onEditRecord={handleEditRecord}
              />
            )}
            {recordView === 'form' && (
              <RecordForm
                initialRecord={editingRecord}
                onSave={handleSaveComplete}
                onCancel={handleCancel}
              />
            )}
          </>
        )}
        {currentView === 'goals' && <GoalsDashboard />}
        {currentView === 'bucketlist' && <BucketlistView />}
        {currentView === 'reading' && <ReadingView />}
        </main>
      </div>
    </div>
  )
}

export default App
