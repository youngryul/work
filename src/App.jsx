import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx'
import LandingPage from './components/LandingPage.jsx'
import LoginForm from './components/LoginForm.jsx'
import TodayView from './components/TodayView.jsx'
import BacklogView from './components/BacklogView.jsx'
import TodoCalendarView from './components/TodoCalendarView.jsx'
import ScheduleCalendarView from './components/ScheduleCalendarView.jsx'
import CalendarView from './components/CalendarView.jsx'
import AnnualReviewView from './components/AnnualReviewView.jsx'
import Review2026View from './components/Review2026View.jsx'
import RecordMainView from './components/RecordMainView.jsx'
import RecordForm from './components/RecordForm.jsx'
import GoalsDashboard from './components/goals/GoalsDashboard.jsx'
import HabitTrackerView from './components/goals/HabitTrackerView.jsx'
import BucketlistView from './components/bucketlist/BucketlistView.jsx'
import ReadingView from './components/reading/ReadingView.jsx'
import TravelView from './components/travel/TravelView.jsx'
import DomesticTravelView from './components/travel/DomesticTravelView.jsx'
import TravelItineraryView from './components/travel/TravelItineraryView.jsx'
import SummerClockView from './components/SummerClockView.jsx'
import PomodoroView from './components/PomodoroView.jsx'
import StudyTimerView from './components/StudyTimerView.jsx'
import StudyTimeView from './components/StudyTimeView.jsx'
import FiveYearQuestionView from './components/FiveYearQuestionView.jsx'
import CategorySettingsModal from './components/CategorySettingsModal.jsx'
import FoodCalorieCalculator from './components/FoodCalorieCalculator.jsx'
import WeightTrackingView from './components/weight/WeightTrackingView.jsx'
import CongratulatoryMoneyView from './components/CongratulatoryMoneyView.jsx'
import FridgeInventoryView from './components/FridgeInventoryView.jsx'
import RecipeView from './components/recipe/RecipeView.jsx'
import ToeicVocabView from './components/ToeicVocabView.jsx'
import AnnouncementView from './components/AnnouncementView.jsx'
import SettingsView from './components/SettingsView.jsx'
import AdminDashboard from './components/admin/AdminDashboard.jsx'
import NonogramView from './components/NonogramView.jsx'
import SudokuView from './components/SudokuView.jsx'
import StockWatchView from './components/stock/StockWatchView.jsx'
import GachaView from './components/gacha/GachaView.jsx'
import FarmView from './components/farm/FarmView.jsx'
import FarmFieldView from './components/farm/FarmFieldView.jsx'
import ShopView from './components/shop/ShopView.jsx'
import MyPageView from './components/gacha/MyPageView.jsx'
import NavigationSidebar from './components/NavigationSidebar.jsx'
import NotificationCenter from './components/NotificationCenter.jsx'
import AnnouncementBanner from './components/AnnouncementBanner.jsx'
import DiaryReminderModal from './components/DiaryReminderModal.jsx'
import ToastContainer from './components/Toast.jsx'
import JellyBalanceBadge from './components/JellyBalanceBadge.jsx'
import DiaryCalendarBalanceBar from './components/DiaryCalendarBalanceBar.jsx'
import TokenDepositRequestModal from './components/TokenDepositRequestModal.jsx'
import ExcelThemeHeader from './components/ExcelThemeHeader.jsx'
import AdSenseBanner from './components/AdSenseBanner.jsx'
import { useNotifications } from './hooks/useNotifications.js'
import { markDiaryReminderShown } from './services/diaryReminderService.js'
import { markFiveYearQuestionReminderShown } from './services/fiveYearQuestionReminderService.js'
import { markWeeklyReminderShown, markMonthlyReminderShown } from './utils/summaryReminder.js'
import { markBacklogStaleReminderShown } from './services/backlogStaleReminderService.js'
import { getThemeWrapperClass, APP_THEMES } from './constants/appThemes.js'
import { useAiTokenInfo } from './hooks/useAiTokenInfo.js'
import { RECIPE_IMAGE_GENERATION_TOKEN_COST } from './constants/aiTokenSettings.js'
import { JELLY_UPDATED_EVENT } from './utils/jellyEvents.js'
import { showToast, TOAST_TYPES } from './components/Toast.jsx'

/**
 * 메인 앱 컨텐츠 컴포넌트 (인증 필요)
 */
function AppContent() {
  const { user, loading, isAdmin, isSuperuser } = useAuth()
  const canUseNotifications = isAdmin || isSuperuser
  const [showLogin, setShowLogin] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('forceLogin') === '1'
  }) // 랜딩 → 로그인 전환
  const [appTheme, setAppTheme] = useState(() => localStorage.getItem('appTheme') || 'posily')

  // 로그인 성공 시 showLogin 초기화
  useEffect(() => {
    if (user) setShowLogin(false)
  }, [user])

  // 이미 로그인된 상태에서 맥앱 redirectTo 처리
  useEffect(() => {
    if (!user || loading) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('redirectTo') !== 'potatobuddy') return

    const redirectToMac = async () => {
      const { supabase } = await import('./config/supabase.js')
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token
      const userId = data?.session?.user?.id
      if (token && userId) {
        window.location.href = `potatobuddy://auth?access_token=${encodeURIComponent(token)}&user_id=${encodeURIComponent(userId)}`
      }
    }
    redirectToMac()
  }, [user, loading])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('forceLogin') !== '1' || !window.__TAURI_INTERNALS__) {
      return
    }

    ;(async () => {
      try {
        const [{ getCurrentWindow }, { LogicalSize }] = await Promise.all([
          import('@tauri-apps/api/window'),
          import('@tauri-apps/api/dpi'),
        ])
        const appWindow = getCurrentWindow()
        await appWindow.setDecorations(true)
        await appWindow.setResizable(true)
        await appWindow.setAlwaysOnTop(false)
        await appWindow.setSize(new LogicalSize(1200, 820))
        await appWindow.center()
      } catch (error) {
        console.error('로그인 창 크기 전환 실패:', error)
      }
    })()
  }, [])

  useEffect(() => {
    localStorage.setItem('appTheme', appTheme)
    document.body.setAttribute('data-theme', appTheme)
  }, [appTheme])

  // localStorage에서 마지막으로 본 화면 불러오기
  const [currentView, setCurrentView] = useState(() => {
    const savedView = localStorage.getItem('lastView')
    return savedView || 'today'
  })
  const [diaryCalendarKey, setDiaryCalendarKey] = useState(0)
  const [diaryOpenDate, setDiaryOpenDate] = useState(null)
  const [diaryDepositModalOpen, setDiaryDepositModalOpen] = useState(false)
  const showJellyTokenBalanceBar =
    currentView === 'diary-calendar' || currentView === 'recipes'
  const tokenBalanceRefreshDep =
    currentView === 'diary-calendar'
      ? diaryCalendarKey
      : currentView === 'recipes'
        ? 'recipes'
        : null
  const { balance: headerTokenBalance, generationCost: headerGenerationCost } = useAiTokenInfo(
    showJellyTokenBalanceBar ? tokenBalanceRefreshDep : null,
  )

  useEffect(() => {
    if (!showJellyTokenBalanceBar) {
      setDiaryDepositModalOpen(false)
      setDiaryOpenDate(null)
    }
  }, [showJellyTokenBalanceBar])

  useEffect(() => {
    if (currentView !== 'diary-calendar') {
      setDiaryOpenDate(null)
    }
  }, [currentView])

  // 공유 링크 (?view=diary-calendar&date=YYYY-MM-DD) 처리
  useEffect(() => {
    if (!user) return

    const params = new URLSearchParams(window.location.search)
    const view = params.get('view')
    const date = params.get('date')

    if (view === 'diary-calendar') {
      setCurrentView('diary-calendar')
      if (date) setDiaryOpenDate(date)
    }

    if (view || date) {
      const cleanUrl = window.location.pathname + window.location.hash
      window.history.replaceState({}, '', cleanUrl)
    }
  }, [user])

  const jellyTokenBalanceBar = (
    <DiaryCalendarBalanceBar
      refreshDep={tokenBalanceRefreshDep}
      onDepositClick={() => setDiaryDepositModalOpen(true)}
      tokenMinRequired={
        currentView === 'recipes' ? RECIPE_IMAGE_GENERATION_TOKEN_COST : undefined
      }
    />
  )

  // 배경 이미지: posily 테마 + 오늘 할일 아닌 경우에만 적용
  useEffect(() => {
    const showBg = appTheme === APP_THEMES.POSILY && currentView !== 'today'
    document.body.style.backgroundImage = showBg ? 'url(/images/심플배경화면.png)' : ''
    document.body.style.backgroundSize = showBg ? 'cover' : ''
    document.body.style.backgroundPosition = showBg ? 'center' : ''
    document.body.style.backgroundAttachment = showBg ? 'fixed' : ''
  }, [appTheme, currentView])

  // 젤리 획득 토스트
  useEffect(() => {
    const handleJellyUpdate = (event) => {
      const awarded = event.detail?.awarded
      if (typeof awarded === 'number' && awarded > 0) {
        showToast(`+${awarded} 젤리를 받았어요!`, TOAST_TYPES.SUCCESS)
      }
    }
    window.addEventListener(JELLY_UPDATED_EVENT, handleJellyUpdate)
    return () => window.removeEventListener(JELLY_UPDATED_EVENT, handleJellyUpdate)
  }, [])

  const [recordView, setRecordView] = useState('main') // 'main' | 'form'
  const [editingRecord, setEditingRecord] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false) // 모바일 사이드바 상태
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false) // 데스크톱 사이드바 접힘 상태
  const [review2026Tab, setReview2026Tab] = useState(null) // 2026 회고록 탭 상태
  const [review2026Params, setReview2026Params] = useState(null) // 2026 회고록 파라미터
  const [showDiaryForm, setShowDiaryForm] = useState(false) // 일기 작성 폼 표시 여부
  const [showCategorySettingsModal, setShowCategorySettingsModal] = useState(false) // 카테고리 설정 모달 표시 여부
  
  // 알림 상태 관리
  const {
    diaryReminder,
    weeklySummaryReminder,
    monthlySummaryReminder,
    fiveYearQuestionReminder,
    purchaseRequestReminder,
    backlogStaleReminder,
    setDiaryReminder,
    setWeeklySummaryReminder,
    setMonthlySummaryReminder,
    setFiveYearQuestionReminder,
    setPurchaseRequestReminder,
    setBacklogStaleReminder,
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

  // currentView가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    if (user && !loading && currentView) {
      localStorage.setItem('lastView', currentView)
    }
  }, [currentView, user, loading])

  // 로그인 시 localStorage에 저장된 마지막 화면 복원 (없으면 'today')
  useEffect(() => {
    if (user && !loading) {
      const savedView = localStorage.getItem('lastView')
      if (savedView) {
        setCurrentView(savedView)
      }
    }
  }, [user, loading])

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
    window.openCategorySettings = () => setShowCategorySettingsModal(true)
    
    // 알림 테스트 함수 설정
    window.showTestNotification = (type = 'diary') => {
      const today = new Date()
      const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayDateString = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
      
      switch (type) {
        case 'diary':
          setDiaryReminder({ isOpen: true, yesterdayDate: yesterdayDateString })
          break
        case 'weekly':
          setWeeklySummaryReminder({ 
            isOpen: true, 
            period: '2024년 1월 1주차',
            weekStart: '2024-01-01',
            weekEnd: '2024-01-07'
          })
          break
        case 'monthly':
          setMonthlySummaryReminder({ 
            isOpen: true, 
            period: '2024년 1월',
            year: 2024,
            month: 1
          })
          break
        case 'five-year':
          setFiveYearQuestionReminder({ 
            isOpen: true, 
            todayDate: todayDateString,
            question: { question_text: '테스트 질문: 오늘 하루를 한 단어로 표현한다면?' }
          })
          break
        default:
          console.log('사용 가능한 타입: diary, weekly, monthly, five-year')
      }
    }
    
    // 알림 상태 새로고침 이벤트 리스너
    const handleRefreshNotifications = () => {
      refreshNotifications()
    }
    
    window.addEventListener('navigateToReview2026', handleNavigate)
    window.addEventListener('refreshNotifications', handleRefreshNotifications)
    return () => {
      window.removeEventListener('navigateToReview2026', handleNavigate)
      window.removeEventListener('refreshNotifications', handleRefreshNotifications)
      delete window.setCurrentView
      delete window.setReview2026Tab
      delete window.setReview2026Params
      delete window.showTestNotification
    }
  }, [setDiaryReminder, setWeeklySummaryReminder, setMonthlySummaryReminder, setFiveYearQuestionReminder, refreshNotifications])

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mb-4"></div>
          <p className="text-gray-600 font-sans">로딩 중...</p>
        </div>
      </div>
    )
  }

  // 비로그인: 랜딩 → 로그인 폼
  if (!user) {
    if (showLogin) return <LoginForm />
    return <LandingPage onLogin={() => setShowLogin(true)} />
  }

  // 로그인한 경우 메인 앱 표시
  return (
    <div className={getThemeWrapperClass(appTheme)}>
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
      <div className={`min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        {/* 모바일 헤더 (햄버거 메뉴) */}
        <header
          className={`md:hidden sticky top-0 z-50 ${
            appTheme === APP_THEMES.EXCEL
              ? 'bg-[#217346] text-white shadow-sm'
              : 'bg-white/80 backdrop-blur-sm shadow-sm'
          }`}
        >
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`text-2xl ${
                appTheme === APP_THEMES.EXCEL
                  ? 'text-white hover:text-white/80'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ☰
            </button>
            {showJellyTokenBalanceBar ? jellyTokenBalanceBar : <JellyBalanceBadge inline />}
          </div>
        </header>

        {/* 엑셀 테마 상단 UI */}
        {appTheme === APP_THEMES.EXCEL && (
          <ExcelThemeHeader currentView={currentView} />
        )}

        {/* 공지사항 + 젤리 (데스크톱) */}
        <div className="sticky top-0 z-30">
          <AnnouncementBanner />
          <div className="hidden md:flex justify-end px-4 py-2">
            {showJellyTokenBalanceBar ? jellyTokenBalanceBar : <JellyBalanceBadge inline />}
          </div>
        </div>

        {showJellyTokenBalanceBar && (
          <TokenDepositRequestModal
            isOpen={diaryDepositModalOpen}
            onClose={() => setDiaryDepositModalOpen(false)}
            tokenBalance={headerTokenBalance}
            generationCost={
              currentView === 'recipes'
                ? RECIPE_IMAGE_GENERATION_TOKEN_COST
                : headerGenerationCost
            }
          />
        )}

        {/* 메인 컨텐츠 */}
        <main className="py-8">
        {currentView === 'today' && <TodayView appTheme={appTheme} />}
        {currentView === 'backlog' && <BacklogView />}
        {currentView === 'todo-calendar' && <TodoCalendarView />}
        {currentView === 'schedule-calendar' && <ScheduleCalendarView />}
        {currentView === 'diary-calendar' && (
          <CalendarView
            calendarKey={diaryCalendarKey}
            onCalendarKeyChange={setDiaryCalendarKey}
            onOpenDepositModal={() => setDiaryDepositModalOpen(true)}
            initialOpenDate={diaryOpenDate}
          />
        )}
        {currentView === 'gacha' && <GachaView />}
        {currentView === 'farm' && <FarmView />}
        {currentView === 'farm-field' && <FarmFieldView />}
        {currentView === 'shop' && <ShopView />}
        {currentView === 'stocks' && <StockWatchView />}
        {currentView === 'my-page' && <MyPageView />}
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
        {currentView === 'habit-tracker' && <HabitTrackerView />}
        {currentView === 'bucketlist' && <BucketlistView />}
        {currentView === 'reading' && <ReadingView />}
        {currentView === 'travel' && <TravelView />}
        {currentView === 'domestic-travel' && <DomesticTravelView />}
        {currentView === 'travel-itinerary' && <TravelItineraryView />}
        {currentView === 'five-year-questions' && <FiveYearQuestionView />}
        {currentView === 'food-calorie' && <FoodCalorieCalculator />}
        {currentView === 'weight-tracking' && <WeightTrackingView />}
        {currentView === 'congratulatory-money' && <CongratulatoryMoneyView />}
        {currentView === 'fridge-inventory' && <FridgeInventoryView />}
        {currentView === 'recipes' && <RecipeView />}
        {currentView === 'toeic-vocab' && <ToeicVocabView />}
        {currentView === 'settings' && (
          <SettingsView
            currentTheme={appTheme}
            onThemeChange={setAppTheme}
          />
        )}
        {currentView === 'announcements' && <AnnouncementView />}
        {currentView === 'nonogram' && <NonogramView />}
        {currentView === 'sudoku' && <SudokuView />}
        {currentView === 'admin' && <AdminDashboard />}
        {currentView === 'study-time' && <StudyTimeView />}
        <AdSenseBanner />
        </main>
      </div>

      {currentView === 'summer-clock' && (
        <SummerClockView onClose={() => setCurrentView('today')} />
      )}
      {currentView === 'pomodoro' && (
        <PomodoroView onClose={() => setCurrentView('today')} />
      )}
      {currentView === 'study-timer' && (
        <StudyTimerView onClose={() => setCurrentView('today')} />
      )}

      {/* 알림 센터 (모든 페이지에서 표시) */}
      {canUseNotifications && (
      <NotificationCenter
        diaryReminder={diaryReminder}
        weeklySummaryReminder={weeklySummaryReminder}
        monthlySummaryReminder={monthlySummaryReminder}
        fiveYearQuestionReminder={fiveYearQuestionReminder}
        purchaseRequestReminder={purchaseRequestReminder}
        backlogStaleReminder={backlogStaleReminder}
        onDiaryReminderClose={async () => {
          setDiaryReminder({ isOpen: false, yesterdayDate: null })
          // 리마인더가 닫혔을 때도 DB에 기록 (나중에 버튼 클릭 시)
          try {
            await markDiaryReminderShown(user?.id)
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
          // 리마인더 표시 기록 (NotificationCenter에서도 호출하지만, 확실하게 하기 위해)
          try {
            await markWeeklyReminderShown(user?.id)
          } catch (error) {
            console.error('리마인더 기록 실패:', error)
          }
          setWeeklySummaryReminder({ isOpen: false, period: '', weekStart: null, weekEnd: null })
          // 알림 상태 새로고침
          setTimeout(() => {
            refreshNotifications()
          }, 500)
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
          // 리마인더 표시 기록 (NotificationCenter에서도 호출하지만, 확실하게 하기 위해)
          try {
            await markMonthlyReminderShown(user?.id)
          } catch (error) {
            console.error('리마인더 기록 실패:', error)
          }
          setMonthlySummaryReminder({ isOpen: false, period: '', year: null, month: null })
          // 알림 상태 새로고침
          setTimeout(() => {
            refreshNotifications()
          }, 500)
        }}
        onDiaryWritten={() => {
          // 일기 작성 완료 시 알림 상태 새로고침
          refreshNotifications()
        }}
        onShowDiaryForm={setShowDiaryForm}
        onWeeklySummaryClose={async () => {
          // 나중에 버튼 클릭 시에도 DB에 기록
          try {
            await markWeeklyReminderShown(user?.id)
          } catch (error) {
            console.error('리마인더 기록 실패:', error)
          }
          setWeeklySummaryReminder({ isOpen: false, period: '', weekStart: null, weekEnd: null })
          // 알림 상태 새로고침
          setTimeout(() => {
            refreshNotifications()
          }, 500)
        }}
        onMonthlySummaryClose={async () => {
          // 나중에 버튼 클릭 시에도 DB에 기록
          try {
            await markMonthlyReminderShown(user?.id)
          } catch (error) {
            console.error('리마인더 기록 실패:', error)
          }
          setMonthlySummaryReminder({ isOpen: false, period: '', year: null, month: null })
          // 알림 상태 새로고침
          setTimeout(() => {
            refreshNotifications()
          }, 500)
        }}
        onFiveYearQuestionAnswer={async () => {
          // 5년 질문 페이지로 이동
          setCurrentView('five-year-questions')
          // 리마인더 표시 기록 (NotificationCenter에서도 호출하지만, 확실하게 하기 위해)
          try {
            await markFiveYearQuestionReminderShown(user?.id)
          } catch (error) {
            console.error('리마인더 기록 실패:', error)
          }
          // 알림 상태 새로고침
          setTimeout(() => {
            refreshNotifications()
          }, 500)
        }}
        onFiveYearQuestionClose={async () => {
          setFiveYearQuestionReminder({ isOpen: false, todayDate: null, question: null })
          // 리마인더가 닫혔을 때도 DB에 기록
          try {
            await markFiveYearQuestionReminderShown(user?.id)
          } catch (error) {
            console.error('리마인더 기록 실패:', error)
          }
          // 알림 상태 새로고침
          setTimeout(() => {
            refreshNotifications()
          }, 500)
        }}
        onPurchaseRequestOpen={() => {
          setCurrentView('admin')
          setPurchaseRequestReminder({ isOpen: false, count: 0 })
        }}
        onPurchaseRequestClose={() => {
          setPurchaseRequestReminder({ isOpen: false, count: 0 })
          setTimeout(() => {
            refreshNotifications()
          }, 500)
        }}
        onBacklogStaleOpen={async () => {
          try {
            await markBacklogStaleReminderShown(user?.id)
          } catch (error) {
            console.error('리마인더 기록 실패:', error)
          }
          setBacklogStaleReminder({ isOpen: false, tasks: [], message: '' })
          setCurrentView('backlog')
          setTimeout(() => {
            refreshNotifications()
          }, 500)
        }}
        onBacklogStaleClose={async () => {
          try {
            await markBacklogStaleReminderShown(user?.id)
          } catch (error) {
            console.error('리마인더 기록 실패:', error)
          }
          setBacklogStaleReminder({ isOpen: false, tasks: [], message: '' })
          setTimeout(() => {
            refreshNotifications()
          }, 500)
        }}
      />
      )}

      {/* 일기 작성 모달 (알림 센터에서 열 때만 표시) */}
      {canUseNotifications && showDiaryForm && diaryReminder.yesterdayDate && (
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

      {/* 카테고리 설정 모달 */}
      <CategorySettingsModal
        isOpen={showCategorySettingsModal}
        onClose={() => setShowCategorySettingsModal(false)}
      />

      {/* 토스트 메시지 컨테이너 */}
      <ToastContainer />

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
