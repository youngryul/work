import { useState } from 'react'
import TodayView from './components/TodayView.jsx'
import BacklogView from './components/BacklogView.jsx'
import CalendarView from './components/CalendarView.jsx'
import AnnualReviewView from './components/AnnualReviewView.jsx'

/**
 * 메인 앱 컴포넌트
 */
function App() {
  const [currentView, setCurrentView] = useState('today')

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
              onClick={() => setCurrentView('calendar')}
              className={`px-4 py-2 rounded-lg transition-all duration-200 text-2xl ${
                currentView === 'calendar'
                  ? 'bg-pink-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-pink-100'
              }`}
            >
              달력
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
          </div>
        </div>
      </nav>

      {/* 메인 컨텐츠 */}
      <main className="py-8">
        {currentView === 'today' && <TodayView />}
        {currentView === 'backlog' && <BacklogView />}
        {currentView === 'calendar' && <CalendarView />}
        {currentView === 'review' && <AnnualReviewView />}
      </main>
    </div>
  )
}

export default App

