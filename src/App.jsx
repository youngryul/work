import { useState } from 'react'
import TodayView from './components/TodayView.jsx'
import BacklogView from './components/BacklogView.jsx'
import TodoCalendarView from './components/TodoCalendarView.jsx'
import CalendarView from './components/CalendarView.jsx'
import AnnualReviewView from './components/AnnualReviewView.jsx'
import RecordMainView from './components/RecordMainView.jsx'
import RecordForm from './components/RecordForm.jsx'

/**
 * 메인 앱 컴포넌트
 */
function App() {
  const [currentView, setCurrentView] = useState('today')
  const [recordView, setRecordView] = useState('main') // 'main' | 'form'
  const [editingRecord, setEditingRecord] = useState(null)

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
    <div className="min-h-screen">
      {/* 네비게이션 */}
      <nav className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex gap-4">
            <button
              onClick={() => setCurrentView('today')}
              className={`px-4 py-2 rounded-lg transition-all duration-200 text-2xl ${
                currentView === 'today'
                  ? 'bg-pink-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-pink-100'
              }`}
            >
              오늘
            </button>
            <button
              onClick={() => setCurrentView('backlog')}
              className={`px-4 py-2 rounded-lg transition-all duration-200 text-2xl ${
                currentView === 'backlog'
                  ? 'bg-pink-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-pink-100'
              }`}
            >
              백로그
            </button>
            <button
              onClick={() => setCurrentView('todo-calendar')}
              className={`px-4 py-2 rounded-lg transition-all duration-200 text-2xl ${
                currentView === 'todo-calendar'
                  ? 'bg-pink-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-pink-100'
              }`}
            >
              할 일 달력
            </button>
            <button
              onClick={() => setCurrentView('diary-calendar')}
              className={`px-4 py-2 rounded-lg transition-all duration-200 text-2xl ${
                currentView === 'diary-calendar'
                  ? 'bg-pink-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-pink-100'
              }`}
            >
              일기 달력
            </button>
            <button
              onClick={() => setCurrentView('review')}
              className={`px-4 py-2 rounded-lg transition-all duration-200 text-2xl ${
                currentView === 'review'
                  ? 'bg-pink-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-pink-100'
              }`}
            >
              회고록
            </button>
            <button
              onClick={() => setCurrentView('records')}
              className={`px-4 py-2 rounded-lg transition-all duration-200 text-2xl ${
                currentView === 'records'
                  ? 'bg-pink-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-pink-100'
              }`}
            >
              프로젝트 기록
            </button>
          </div>
        </div>
      </nav>

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
      </main>
    </div>
  )
}

export default App
