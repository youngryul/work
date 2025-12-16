import { useState } from 'react'
import TodayView from './components/TodayView.jsx'
import BacklogView from './components/BacklogView.jsx'

/**
 * 메인 앱 컴포넌트
 */
function App() {
  const [currentView, setCurrentView] = useState('today')

  return (
    <div className="min-h-screen">
      {/* 네비게이션 */}
      <nav className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex gap-4">
            <button
              onClick={() => setCurrentView('today')}
              className={`px-4 py-2 rounded-lg transition-all duration-200 text-lg ${
                currentView === 'today'
                  ? 'bg-pink-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-pink-100'
              }`}
            >
              오늘
            </button>
            <button
              onClick={() => setCurrentView('backlog')}
              className={`px-4 py-2 rounded-lg transition-all duration-200 text-lg ${
                currentView === 'backlog'
                  ? 'bg-pink-400 text-white shadow-md'
                  : 'text-gray-600 hover:bg-pink-100'
              }`}
            >
              백로그
            </button>
          </div>
        </div>
      </nav>

      {/* 메인 컨텐츠 */}
      <main className="py-8">
        {currentView === 'today' ? <TodayView /> : <BacklogView />}
      </main>
    </div>
  )
}

export default App

