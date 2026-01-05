import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import LoginForm from './components/LoginForm.jsx'
import TodayView from './components/TodayView.jsx'
import BacklogView from './components/BacklogView.jsx'
import TodoCalendarView from './components/TodoCalendarView.jsx'
import CalendarView from './components/CalendarView.jsx'
import AnnualReviewView from './components/AnnualReviewView.jsx'
import Review2026View from './components/Review2026View.jsx'
import RecordMainView from './components/RecordMainView.jsx'
import RecordForm from './components/RecordForm.jsx'
import GoalsDashboard from './components/goals/GoalsDashboard.jsx'
import BucketlistView from './components/bucketlist/BucketlistView.jsx'
import ReadingView from './components/reading/ReadingView.jsx'
import TravelView from './components/travel/TravelView.jsx'
import NavigationSidebar from './components/NavigationSidebar.jsx'
import NotificationCenter from './components/NotificationCenter.jsx'
import DiaryReminderModal from './components/DiaryReminderModal.jsx'
import { useNotifications } from './hooks/useNotifications.js'
import { markDiaryReminderShown } from './services/diaryReminderService.js'
import { markWeeklyReminderShown, markMonthlyReminderShown } from './utils/summaryReminder.js'

/**
 * 메인 앱 컨텐츠 컴포넌트 (인증 필요)
 */
function AppContent() {
  const { user, loading } = useAuth()
  const [currentView, setCurrentView] = useState('today')
  const [recordView, setRecordView] = useState('main') // 'main' | 'form'
  const [editingRecord, setEditingRecord] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false) // 모바일 사이드바 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false) // 데스크톱 사이드바 접힘 상태
  const [review2026Tab, setReview2026Tab] = useState(null) // 2026 회고록 탭 상태
  const [review2026Params, setReview2026Params] = useState(null) // 2026 회고록 파라미터
  const [showDiaryForm, setShowDiaryForm] = useState(false) // 일기 작성 폼 표시 여부
  
  // 알림 상태 관리
  const {
    diaryReminder,
    weeklySummaryReminder,
    monthlySummaryReminder,
    setDiaryReminder,
    setWeeklySummaryReminder,
    setMonthlySummaryReminder,
    refreshNotifications,
  } = useNotifications()

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

  // 2026 회고록 네비게이션 이벤트 리스너 및 전역 함수 설정
  useEffect(() => {
    const handleNavigate = (event) => {
      setCurrentView('review-2026')
      setReview2026Tab(event.detail.tab)
      setReview2026Params(event.detail)
    }
    
    // 전역 함수 설정 (다른 컴포넌트에서 직접 호출 가능)
    window.setCurrentView = setCurrentView
    window.setReview2026Tab = setReview2026Tab
    window.setReview2026Params = setReview2026Params
    
    window.addEventListener('navigateToReview2026', handleNavigate)
    return () => {
      window.removeEventListener('navigateToReview2026', handleNavigate)
      delete window.setCurrentView
      delete window.setReview2026Tab
      delete window.setReview2026Params
    }
  }, [])

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-sans">로딩 중...</p>
        </div>
      </div>
    )
  }

  // 로그인하지 않은 경우
  if (!user) {
    return <LoginForm />
  }

  // 로그인한 경우 메인 앱 표시
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
        {currentView === 'review-2026' && (
          <Review2026View 
            initialTab={review2026Tab}
            initialParams={review2026Params}
          />
        )}
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
        {currentView === 'travel' && <TravelView />}
        </main>
      </div>

      {/* 알림 센터 (모든 페이지에서 표시) */}
      <NotificationCenter
        diaryReminder={diaryReminder}
        weeklySummaryReminder={weeklySummaryReminder}
        monthlySummaryReminder={monthlySummaryReminder}
        onDiaryReminderClose={async () => {
          setDiaryReminder({ isOpen: false, yesterdayDate: null })
          // 리마인더가 닫혔을 때도 DB에 기록 (나중에 버튼 클릭 시)
          try {
            await markDiaryReminderShown()
          } catch (error) {
            console.error('리마인더 기록 실패:', error)
          }
          // 알림 상태 새로고침
          setTimeout(() => {
            refreshNotifications()
          }, 500)
        }}
        onWeeklySummaryGenerate={async () => {
          // 2026 회고록 페이지로 이동하고 주간 탭 열기
          window.dispatchEvent(new CustomEvent('navigateToReview2026', { 
            detail: { 
              tab: 'weekly-work', 
              weekStart: weeklySummaryReminder.weekStart, 
              weekEnd: weeklySummaryReminder.weekEnd 
            }
          }))
          // 리마인더 표시 기록
          try {
            await markWeeklyReminderShown()
          } catch (error) {
            console.error('리마인더 기록 실패:', error)
          }
          setWeeklySummaryReminder({ isOpen: false, period: '', weekStart: null, weekEnd: null })
        }}
        onMonthlySummaryGenerate={async () => {
          // 2026 회고록 페이지로 이동하고 월간 탭 열기
          window.dispatchEvent(new CustomEvent('navigateToReview2026', { 
            detail: { 
              tab: 'monthly-diary', 
              year: monthlySummaryReminder.year, 
              month: monthlySummaryReminder.month 
            }
          }))
          // 리마인더 표시 기록
          try {
            await markMonthlyReminderShown()
          } catch (error) {
            console.error('리마인더 기록 실패:', error)
          }
          setMonthlySummaryReminder({ isOpen: false, period: '', year: null, month: null })
        }}
        onDiaryWritten={() => {
          // 일기 작성 완료 시 알림 상태 새로고침
          refreshNotifications()
        }}
        onShowDiaryForm={setShowDiaryForm}
        onWeeklySummaryClose={async () => {
          // 나중에 버튼 클릭 시에도 DB에 기록
          try {
            await markWeeklyReminderShown()
          } catch (error) {
            console.error('리마인더 기록 실패:', error)
          }
          setWeeklySummaryReminder({ isOpen: false, period: '', weekStart: null, weekEnd: null })
        }}
        onMonthlySummaryClose={async () => {
          // 나중에 버튼 클릭 시에도 DB에 기록
          try {
            await markMonthlyReminderShown()
          } catch (error) {
            console.error('리마인더 기록 실패:', error)
          }
          setMonthlySummaryReminder({ isOpen: false, period: '', year: null, month: null })
        }}
      />

      {/* 일기 작성 모달 (알림 센터에서 열 때만 표시) */}
      {showDiaryForm && diaryReminder.yesterdayDate && (
        <DiaryReminderModal
          yesterdayDate={diaryReminder.yesterdayDate}
          isOpen={true}
          onClose={() => {
            setShowDiaryForm(false)
            setDiaryReminder({ isOpen: false, yesterdayDate: null })
            refreshNotifications()
          }}
          onWriteDiary={() => {
            setShowDiaryForm(false)
            refreshNotifications()
          }}
        />
      )}
    </div>
  )
}

/**
 * 메인 앱 컴포넌트 (인증 프로바이더로 감싸기)
 */
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
