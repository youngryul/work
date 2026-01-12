import { useState, useEffect } from 'react'
import { 
  getWeeksWithWorkReports, 
  generateWeeklyWorkReport, 
  saveWeeklyWorkReport,
  getWeeklyWorkReport,
  getMonthlyWorkReport,
  getWorkReportDatesByMonth,
  getWeeksWithDiaries,
  generateWeeklyDiarySummary,
  saveWeeklyDiarySummary,
  getWeeklyDiarySummary,
  getMonthlyDiarySummary,
  generateMonthlyDiarySummary,
  saveMonthlyDiarySummary,
  getWeekStart,
  getWeekEnd
} from '../services/workReportService.js'
import { getDiariesByMonth } from '../services/diaryService.js'
import ReactMarkdown from 'react-markdown'

/**
 * 2026년 회고록 뷰 컴포넌트 (2025년 12월부터 시작)
 * @param {string} initialTab - 초기 탭 ('weekly-work' | 'weekly-diary' | 'monthly-diary')
 * @param {Object} initialParams - 초기 파라미터 (weekStart, weekEnd, year, month 등)
 */
export default function Review2026View({ initialTab, initialParams }) {
  const [startYear] = useState(2025)
  const [startMonth] = useState(12)
  const [currentYear] = useState(2026)
  const [activeTab, setActiveTab] = useState(initialTab || 'weekly-work') // 'weekly-work' | 'weekly-diary' | 'monthly-diary' | 'monthly-work'
  
  // 현재 날짜 (YYYY-MM-DD 형식)
  const getTodayDateString = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  // 주가 이전 주인지 확인 (주 종료일이 현재 날짜 이전인지)
  const isPastWeek = (weekEnd) => {
    const today = getTodayDateString()
    return weekEnd < today
  }
  
  // 주간 업무일지 관련
  const [workWeeks, setWorkWeeks] = useState([])
  const [selectedWorkWeek, setSelectedWorkWeek] = useState(null)
  const [weeklyWorkReport, setWeeklyWorkReport] = useState(null)
  const [isGeneratingWeeklyWork, setIsGeneratingWeeklyWork] = useState(false)
  const [showWeeklyWorkModal, setShowWeeklyWorkModal] = useState(false)
  const [selectedWorkMonth, setSelectedWorkMonth] = useState(() => {
    // 기본값: 현재 달
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })
  
  // 월간 업무일지 관련
  const [monthlyWorkReport, setMonthlyWorkReport] = useState(null)
  const [isGeneratingMonthlyWork, setIsGeneratingMonthlyWork] = useState(false)
  
  // 주간 일기 정리 관련
  const [diaryWeeks, setDiaryWeeks] = useState([])
  const [weeklyDiarySummary, setWeeklyDiarySummary] = useState(null)
  const [isGeneratingWeeklyDiary, setIsGeneratingWeeklyDiary] = useState(false)
  const [showWeeklyDiaryModal, setShowWeeklyDiaryModal] = useState(false)
  const [selectedDiaryMonth, setSelectedDiaryMonth] = useState(() => {
    // 기본값: 현재 달
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  })
  
  // 월간 일기 정리 관련
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [monthlyDiarySummary, setMonthlyDiarySummary] = useState(null)
  const [isGeneratingMonthlyDiary, setIsGeneratingMonthlyDiary] = useState(false)

  /**
   * 주간 업무일지가 생성된 주 목록 로드
   */
  const loadWorkWeeks = async () => {
    try {
      // 2025년 12월부터 현재 연도까지
      const allWeeks = []
      const weeksMap = new Map() // 중복 제거를 위한 Map (weekStart-weekEnd를 키로 사용)
      
      for (let year = startYear; year <= currentYear; year++) {
        const weeks = await getWeeksWithWorkReports(year)
        // 각 주에 대해 이미 생성된 업무일지가 있는지 확인
        for (const week of weeks) {
          const weekKey = `${week.weekStart}-${week.weekEnd}`
          
          // 이미 같은 주가 있으면 건너뛰기 (현재 사용자의 것만 유지)
          if (weeksMap.has(weekKey)) {
            continue
          }
          
          const existing = await getWeeklyWorkReport(week.weekStart, week.weekEnd)
          week.hasReport = !!existing
          week.reportContent = existing?.reportContent || null
          
          weeksMap.set(weekKey, week)
        }
      }
      
      // Map의 값들을 배열로 변환
      setWorkWeeks(Array.from(weeksMap.values()))
    } catch (error) {
      console.error('주 목록 로드 오류:', error)
      alert('주 목록을 불러오는데 실패했습니다.')
    }
  }
  
  /**
   * 주간 일기가 있는 주 목록 로드
   */
  const loadDiaryWeeks = async () => {
    try {
      // 2025년 12월부터 현재 연도까지
      const weeksMap = new Map() // 중복 제거를 위한 Map (weekStart-weekEnd를 키로 사용)
      const { getWeeksWithDiaries } = await import('../services/workReportService.js')
      
      for (let year = startYear; year <= currentYear; year++) {
        const weeks = await getWeeksWithDiaries(year)
        // 각 주에 대해 이미 생성된 일기 정리가 있는지 확인
        for (const week of weeks) {
          const weekKey = `${week.weekStart}-${week.weekEnd}`
          
          // 이미 같은 주가 있으면 건너뛰기 (현재 사용자의 것만 유지)
          if (weeksMap.has(weekKey)) {
            continue
          }
          
          const existing = await getWeeklyDiarySummary(week.weekStart, week.weekEnd)
          week.hasSummary = !!existing
          week.summaryContent = existing?.summaryContent || null
          
          weeksMap.set(weekKey, week)
        }
      }
      
      // Map의 값들을 배열로 변환
      setDiaryWeeks(Array.from(weeksMap.values()))
    } catch (error) {
      console.error('주간 일기 주 목록 로드 오류:', error)
      alert('주간 일기 주 목록을 불러오는데 실패했습니다.')
    }
  }

  /**
   * 주간 업무일지 생성
   */
  const handleGenerateWeeklyWorkReport = async (week) => {
    // 이전 주가 아니면 생성 불가
    if (!isPastWeek(week.weekEnd)) {
      alert('현재 주나 미래 주의 업무일지는 생성할 수 없습니다. 이전 주만 생성 가능합니다.')
      return
    }
    
    // 해당 주에만 생성 중 상태 설정
    setWorkWeeks(prevWeeks => 
      prevWeeks.map(w => 
        w.weekStart === week.weekStart && w.weekEnd === week.weekEnd
          ? { ...w, isGenerating: true }
          : w
      )
    )
    setIsGeneratingWeeklyWork(true)
    
    try {
      const report = await generateWeeklyWorkReport(week.weekStart, week.weekEnd, week.dates)
      await saveWeeklyWorkReport(week.weekStart, week.weekEnd, report)
      
      // 목록 업데이트
      setWorkWeeks(prevWeeks => 
        prevWeeks.map(w => 
          w.weekStart === week.weekStart && w.weekEnd === week.weekEnd
            ? { ...w, hasReport: true, reportContent: report, isGenerating: false }
            : w
        )
      )
    } catch (error) {
      console.error('주간 업무일지 생성 오류:', error)
      alert(error.message || '주간 업무일지 생성에 실패했습니다.')
      // 에러 발생 시 생성 중 상태 해제
      setWorkWeeks(prevWeeks => 
        prevWeeks.map(w => 
          w.weekStart === week.weekStart && w.weekEnd === week.weekEnd
            ? { ...w, isGenerating: false }
            : w
        )
      )
    } finally {
      setIsGeneratingWeeklyWork(false)
    }
  }
  
  /**
   * 주간 업무일지 팝업 표시
   */
  const handleShowWeeklyWorkModal = (week) => {
    if (week.hasReport && week.reportContent) {
      setWeeklyWorkReport({ ...week, content: week.reportContent })
      setShowWeeklyWorkModal(true)
    }
  }
  
  /**
   * 월간 업무일지 생성
   */
  const handleGenerateMonthlyWorkReport = async (year, month) => {
    setIsGeneratingMonthlyWork(true)
    try {
      const { generateMonthlyWorkReport, saveMonthlyWorkReport } = await import('../services/workReportService.js')
      
      // 기존 월간 업무일지 확인
      const existing = await getMonthlyWorkReport(year, month)
      if (existing) {
        if (confirm('이미 생성된 월간 업무일지가 있습니다. 다시 생성하시겠습니까?')) {
          const report = await generateMonthlyWorkReport(year, month)
          await saveMonthlyWorkReport(year, month, report)
          setMonthlyWorkReport({ year, month, content: report })
        } else {
          setMonthlyWorkReport({ year, month, content: existing.reportContent })
        }
      } else {
        const report = await generateMonthlyWorkReport(year, month)
        await saveMonthlyWorkReport(year, month, report)
        setMonthlyWorkReport({ year, month, content: report })
      }
    } catch (error) {
      console.error('월간 업무일지 생성 오류:', error)
      alert(error.message || '월간 업무일지 생성에 실패했습니다.')
    } finally {
      setIsGeneratingMonthlyWork(false)
    }
  }

  /**
   * 주간 일기 정리 생성
   */
  const handleGenerateWeeklyDiarySummary = async (week) => {
    // 이전 주가 아니면 생성 불가
    if (!isPastWeek(week.weekEnd)) {
      alert('현재 주나 미래 주의 일기 정리는 생성할 수 없습니다. 이전 주만 생성 가능합니다.')
      return
    }
    
    // 해당 주에만 생성 중 상태 설정
    setDiaryWeeks(prevWeeks => 
      prevWeeks.map(w => 
        w.weekStart === week.weekStart && w.weekEnd === week.weekEnd
          ? { ...w, isGenerating: true }
          : w
      )
    )
    setIsGeneratingWeeklyDiary(true)
    
    try {
      const summary = await generateWeeklyDiarySummary(week.weekStart, week.weekEnd, week.diaries)
      await saveWeeklyDiarySummary(week.weekStart, week.weekEnd, summary)
      
      // 목록 업데이트
      setDiaryWeeks(prevWeeks => 
        prevWeeks.map(w => 
          w.weekStart === week.weekStart && w.weekEnd === week.weekEnd
            ? { ...w, hasSummary: true, summaryContent: summary, isGenerating: false }
            : w
        )
      )
    } catch (error) {
      console.error('주간 일기 정리 생성 오류:', error)
      alert(error.message || '주간 일기 정리 생성에 실패했습니다.')
      // 에러 발생 시 생성 중 상태 해제
      setDiaryWeeks(prevWeeks => 
        prevWeeks.map(w => 
          w.weekStart === week.weekStart && w.weekEnd === week.weekEnd
            ? { ...w, isGenerating: false }
            : w
        )
      )
    } finally {
      setIsGeneratingWeeklyDiary(false)
    }
  }
  
  /**
   * 주간 일기 정리 팝업 표시
   */
  const handleShowWeeklyDiaryModal = (week) => {
    if (week.hasSummary && week.summaryContent) {
      setWeeklyDiarySummary({ ...week, content: week.summaryContent })
      setShowWeeklyDiaryModal(true)
    }
  }

  /**
   * 월간 일기 정리 생성
   */
  const handleGenerateMonthlyDiarySummary = async (year, month) => {
    setIsGeneratingMonthlyDiary(true)
    try {
      // 해당 월의 일기 조회
      const diaries = await getDiariesByMonth(year, month)
      if (diaries.length === 0) {
        alert(`${year}년 ${month}월에는 일기가 없습니다.`)
        return
      }

      // 기존 월간 일기 정리 확인
      const existing = await getMonthlyDiarySummary(year, month)
      if (existing) {
        if (confirm('이미 생성된 월간 일기 정리가 있습니다. 다시 생성하시겠습니까?')) {
          const summary = await generateMonthlyDiarySummary(year, month, diaries)
          await saveMonthlyDiarySummary(year, month, summary)
          setMonthlyDiarySummary({ year, month, content: summary })
        } else {
          setMonthlyDiarySummary({ year, month, content: existing.summaryContent })
        }
      } else {
        const summary = await generateMonthlyDiarySummary(year, month, diaries)
        await saveMonthlyDiarySummary(year, month, summary)
        setMonthlyDiarySummary({ year, month, content: summary })
      }
      setSelectedMonth(month)
    } catch (error) {
      console.error('월간 일기 정리 생성 오류:', error)
      alert(error.message || '월간 일기 정리 생성에 실패했습니다.')
    } finally {
      setIsGeneratingMonthlyDiary(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'weekly-work') {
      loadWorkWeeks()
    } else if (activeTab === 'weekly-diary') {
      loadDiaryWeeks()
    }
  }, [activeTab, startYear, currentYear])

  // 초기 파라미터가 있으면 해당 주/월의 요약 생성
  useEffect(() => {
    if (initialParams) {
      if (initialParams.tab === 'weekly-work' && initialParams.weekStart && initialParams.weekEnd) {
        // 주간 업무일지 생성 - 해당 주의 업무일지 날짜 가져오기
        const loadAndGenerate = async () => {
          try {
            const { getWorkReportDatesByMonth } = await import('../services/workReportService.js')
            const { getWeekStart, getWeekEnd } = await import('../services/workReportService.js')
            
            // 주 시작일과 종료일로부터 해당 주의 업무일지 날짜 찾기
            const weekStartDate = new Date(initialParams.weekStart)
            const year = weekStartDate.getFullYear()
            const month = weekStartDate.getMonth() + 1
            
            const reportDates = await getWorkReportDatesByMonth(year, month)
            const weekDates = reportDates.filter(date => {
              const dateObj = new Date(date)
              return dateObj >= weekStartDate && dateObj <= new Date(initialParams.weekEnd)
            })
            
            const week = {
              weekStart: initialParams.weekStart,
              weekEnd: initialParams.weekEnd,
              dates: weekDates,
              reportCount: weekDates.length
            }
            await handleGenerateWeeklyWorkReport(week)
          } catch (error) {
            console.error('주간 업무일지 자동 생성 오류:', error)
          }
        }
        loadAndGenerate()
      } else if (initialParams.tab === 'monthly-diary' && initialParams.year && initialParams.month) {
        // 월간 일기 정리 생성
        handleGenerateMonthlyDiarySummary(initialParams.year, initialParams.month)
      }
    }
  }, [initialParams])

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 font-sans">
          2026 회고록
        </h1>
        <p className="text-xl text-gray-600 font-sans">
          업무일지와 일기를 기반으로 한 AI 회고록 (2025년 12월부터)
        </p>
      </div>

      {/* 탭 메뉴 */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('weekly-work')}
          className={`px-6 py-3 transition-colors duration-200 text-lg font-medium border-b-2 font-sans ${
            activeTab === 'weekly-work'
              ? 'border-indigo-500 text-indigo-600 font-semibold'
              : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
          }`}
        >
          주간 업무일지
        </button>
        <button
          onClick={() => setActiveTab('weekly-diary')}
          className={`px-6 py-3 transition-colors duration-200 text-lg font-medium border-b-2 font-sans ${
            activeTab === 'weekly-diary'
              ? 'border-indigo-500 text-indigo-600 font-semibold'
              : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
          }`}
        >
          주간 일기 정리
        </button>
        <button
          onClick={() => setActiveTab('monthly-work')}
          className={`px-6 py-3 transition-colors duration-200 text-lg font-medium border-b-2 font-sans ${
            activeTab === 'monthly-work'
              ? 'border-indigo-500 text-indigo-600 font-semibold'
              : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
          }`}
        >
          월간 업무일지
        </button>
        <button
          onClick={() => setActiveTab('monthly-diary')}
          className={`px-6 py-3 transition-colors duration-200 text-lg font-medium border-b-2 font-sans ${
            activeTab === 'monthly-diary'
              ? 'border-indigo-500 text-indigo-600 font-semibold'
              : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
          }`}
        >
          월간 일기 정리
        </button>
      </div>

      {/* 주간 업무일지 탭 */}
      {activeTab === 'weekly-work' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 font-sans">주간 업무일지 생성</h2>
            <p className="text-gray-600 mb-4 font-sans">
              업무일지를 1개 이상 생성한 주를 선택하여 주간 업무일지를 생성할 수 있습니다.
            </p>
            
            {workWeeks.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xl font-sans">
                업무일지가 생성된 주가 없습니다.
              </div>
            ) : (() => {
              // 주간 업무일지를 월별로 그룹화
              const groupedByMonth = {}
              workWeeks.forEach((week) => {
                // weekStart에서 연도와 월 추출
                const [year, month] = week.weekStart.split('-').slice(0, 2)
                const monthKey = `${year}-${month}`
                
                if (!groupedByMonth[monthKey]) {
                  groupedByMonth[monthKey] = []
                }
                groupedByMonth[monthKey].push(week)
              })
              
              // 월별로 정렬 (최신순)
              const sortedMonths = Object.keys(groupedByMonth).sort().reverse()
              
              const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
              
              // 선택한 달의 주간 업무일지만 필터링
              const selectedWeeks = groupedByMonth[selectedWorkMonth] || []
              
              return (
                <div className="space-y-6">
                  {/* 월 선택 드롭다운 */}
                  <div className="flex items-center gap-4">
                    <label className="text-base font-semibold text-gray-700 font-sans">
                      월 선택:
                    </label>
                    <select
                      value={selectedWorkMonth}
                      onChange={(e) => setSelectedWorkMonth(e.target.value)}
                      className="px-4 py-2 border-2 border-gray-300 rounded-lg text-base focus:border-indigo-400 focus:outline-none font-sans"
                    >
                      {sortedMonths.map((monthKey) => {
                        const [year, month] = monthKey.split('-')
                        const monthName = monthNames[parseInt(month) - 1]
                        return (
                          <option key={monthKey} value={monthKey}>
                            {year}년 {monthName}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  
                  {/* 선택한 달의 주간 업무일지 표시 */}
                  {selectedWeeks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-lg font-sans">
                      선택한 달에 업무일지가 생성된 주가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-gray-800 font-sans border-b-2 border-gray-300 pb-2">
                        {selectedWorkMonth.split('-')[0]}년 {monthNames[parseInt(selectedWorkMonth.split('-')[1]) - 1]}
                      </h3>
                      <div className="space-y-3">
                        {selectedWeeks.map((week) => (
                          <div
                            key={`${week.weekStart}-${week.weekEnd}`}
                            className={`p-4 bg-gray-50 rounded-lg border border-gray-200 transition-colors ${
                              week.hasReport 
                                ? 'hover:bg-gray-100 cursor-pointer' 
                                : 'hover:bg-gray-100'
                            }`}
                            onClick={() => week.hasReport && handleShowWeeklyWorkModal(week)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-lg font-bold text-gray-800 font-sans">
                                  {week.weekStart} ~ {week.weekEnd}
                                </h4>
                                <p className="text-sm text-gray-600 font-sans">
                                  완료된 할 일이 있는 날 {week.completedTaskDayCount || week.dates.length || 0}일
                                  {week.hasReport && <span className="ml-2 text-green-600">✓ 생성됨</span>}
                                </p>
                              </div>
                              {!week.hasReport && isPastWeek(week.weekEnd) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleGenerateWeeklyWorkReport(week)
                                  }}
                                  disabled={isGeneratingWeeklyWork && week.isGenerating}
                                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors duration-200 text-base font-medium font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {(isGeneratingWeeklyWork && week.isGenerating) ? '생성 중...' : '주간 업무일지 생성'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

        </div>
      )}

      {/* 월간 업무일지 탭 */}
      {activeTab === 'monthly-work' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 font-sans">월간 업무일지 생성</h2>
            <p className="text-gray-600 mb-4 font-sans">
              월이 지나면 월초에 자동으로 생성되는 편지 형식의 월간 업무일지입니다.
            </p>
            
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {/* 2025년 12월부터 */}
              <button
                onClick={() => handleGenerateMonthlyWorkReport(2025, 12)}
                disabled={isGeneratingMonthlyWork}
                className="px-4 py-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-base font-medium font-sans disabled:opacity-50 disabled:cursor-not-allowed"
              >
                2025.12
              </button>
              {/* 2026년 1월부터 12월까지 */}
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <button
                  key={month}
                  onClick={() => handleGenerateMonthlyWorkReport(2026, month)}
                  disabled={isGeneratingMonthlyWork}
                  className="px-4 py-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-base font-medium font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  2026.{month}
                </button>
              ))}
            </div>
          </div>

          {/* 생성된 월간 업무일지 표시 */}
          {monthlyWorkReport && (
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800 font-sans">
                  {monthlyWorkReport.year}년 {monthlyWorkReport.month}월 업무일지
                </h2>
                <button
                  onClick={() => setMonthlyWorkReport(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-800 font-sans leading-relaxed">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-3 text-gray-900 font-sans" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-4 mb-2 text-gray-900 font-sans" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-3 mb-2 text-gray-800 font-sans" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-2 text-gray-700 text-sm font-sans" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-700 text-sm font-sans" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-700 text-sm font-sans" {...props} />,
                    li: ({ node, ...props }) => <li className="ml-4 font-sans" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900 font-sans" {...props} />,
                  }}
                >
                  {monthlyWorkReport.content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 주간 일기 정리 탭 */}
      {activeTab === 'weekly-diary' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 font-sans">주간 일기 정리 생성</h2>
            <p className="text-gray-600 mb-4 font-sans">
              일기를 1개 이상 작성한 주를 선택하여 주간 일기 정리를 생성할 수 있습니다.
            </p>
            
            {diaryWeeks.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xl font-sans">
                일기가 작성된 주가 없습니다.
              </div>
            ) : (() => {
              // 주간 일기를 월별로 그룹화
              const groupedByMonth = {}
              diaryWeeks.forEach((week) => {
                // weekStart에서 연도와 월 추출
                const [year, month] = week.weekStart.split('-').slice(0, 2)
                const monthKey = `${year}-${month}`
                
                if (!groupedByMonth[monthKey]) {
                  groupedByMonth[monthKey] = []
                }
                groupedByMonth[monthKey].push(week)
              })
              
              // 월별로 정렬 (최신순)
              const sortedMonths = Object.keys(groupedByMonth).sort().reverse()
              
              const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
              
              // 선택한 달의 주간 일기만 필터링
              const selectedWeeks = groupedByMonth[selectedDiaryMonth] || []
              
              return (
                <div className="space-y-6">
                  {/* 월 선택 드롭다운 */}
                  <div className="flex items-center gap-4">
                    <label className="text-base font-semibold text-gray-700 font-sans">
                      월 선택:
                    </label>
                    <select
                      value={selectedDiaryMonth}
                      onChange={(e) => setSelectedDiaryMonth(e.target.value)}
                      className="px-4 py-2 border-2 border-gray-300 rounded-lg text-base focus:border-indigo-400 focus:outline-none font-sans"
                    >
                      {sortedMonths.map((monthKey) => {
                        const [year, month] = monthKey.split('-')
                        const monthName = monthNames[parseInt(month) - 1]
                        return (
                          <option key={monthKey} value={monthKey}>
                            {year}년 {monthName}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                  
                  {/* 선택한 달의 주간 일기 표시 */}
                  {selectedWeeks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-lg font-sans">
                      선택한 달에 일기가 작성된 주가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold text-gray-800 font-sans border-b-2 border-gray-300 pb-2">
                        {selectedDiaryMonth.split('-')[0]}년 {monthNames[parseInt(selectedDiaryMonth.split('-')[1]) - 1]}
                      </h3>
                      <div className="space-y-3">
                        {selectedWeeks.map((week) => (
                          <div
                            key={`${week.weekStart}-${week.weekEnd}`}
                            className={`p-4 bg-gray-50 rounded-lg border border-gray-200 transition-colors ${
                              week.hasSummary 
                                ? 'hover:bg-gray-100 cursor-pointer' 
                                : 'hover:bg-gray-100'
                            }`}
                            onClick={() => week.hasSummary && handleShowWeeklyDiaryModal(week)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-lg font-bold text-gray-800 font-sans">
                                  {week.weekStart} ~ {week.weekEnd}
                                </h4>
                                <p className="text-sm text-gray-600 font-sans">
                                  일기 {week.diaryCount}개
                                  {week.hasSummary && <span className="ml-2 text-green-600">✓ 생성됨</span>}
                                </p>
                              </div>
                              {!week.hasSummary && isPastWeek(week.weekEnd) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleGenerateWeeklyDiarySummary(week)
                                  }}
                                  disabled={isGeneratingWeeklyDiary && week.isGenerating}
                                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors duration-200 text-base font-medium font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {(isGeneratingWeeklyDiary && week.isGenerating) ? '생성 중...' : '주간 일기 정리 생성'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* 월간 일기 정리 탭 */}
      {activeTab === 'monthly-diary' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 font-sans">월간 일기 정리 생성</h2>
            <p className="text-gray-600 mb-4 font-sans">
              월이 지나면 월초에 자동으로 생성되는 편지 형식의 월간 일기 정리입니다.
            </p>
            
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {/* 2025년 12월부터 */}
              <button
                onClick={() => handleGenerateMonthlyDiarySummary(2025, 12)}
                disabled={isGeneratingMonthlyDiary}
                className="px-4 py-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-base font-medium font-sans disabled:opacity-50 disabled:cursor-not-allowed"
              >
                2025.12
              </button>
              {/* 2026년 1월부터 12월까지 */}
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <button
                  key={month}
                  onClick={() => handleGenerateMonthlyDiarySummary(2026, month)}
                  disabled={isGeneratingMonthlyDiary}
                  className="px-4 py-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200 text-base font-medium font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  2026.{month}
                </button>
              ))}
            </div>
          </div>

          {/* 생성된 월간 일기 정리 표시 */}
          {monthlyDiarySummary && (
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800 font-sans">
                  {monthlyDiarySummary.year}년 {monthlyDiarySummary.month}월 일기 정리
                </h2>
                <button
                  onClick={() => setMonthlyDiarySummary(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-800 font-sans leading-relaxed">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-3 text-gray-900 font-sans" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-4 mb-2 text-gray-900 font-sans" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-3 mb-2 text-gray-800 font-sans" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-2 text-gray-700 text-sm font-sans" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-700 text-sm font-sans" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-700 text-sm font-sans" {...props} />,
                    li: ({ node, ...props }) => <li className="ml-4 font-sans" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900 font-sans" {...props} />,
                  }}
                >
                  {monthlyDiarySummary.content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 주간 업무일지 팝업 */}
      {showWeeklyWorkModal && weeklyWorkReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800 font-sans">
                {weeklyWorkReport.weekStart} ~ {weeklyWorkReport.weekEnd} 주간 업무일지
              </h2>
              <button
                onClick={() => {
                  setShowWeeklyWorkModal(false)
                  setWeeklyWorkReport(null)
                }}
                className="text-gray-400 hover:text-gray-600 text-4xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-800 font-sans leading-relaxed">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-3 text-gray-900 font-sans" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-4 mb-2 text-gray-900 font-sans" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-3 mb-2 text-gray-800 font-sans" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-2 text-gray-700 text-sm font-sans" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-700 text-sm font-sans" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-700 text-sm font-sans" {...props} />,
                    li: ({ node, ...props }) => <li className="ml-4 font-sans" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900 font-sans" {...props} />,
                  }}
                >
                  {weeklyWorkReport.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 주간 일기 정리 팝업 */}
      {showWeeklyDiaryModal && weeklyDiarySummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-800 font-sans">
                {weeklyDiarySummary.weekStart} ~ {weeklyDiarySummary.weekEnd} 주간 일기 정리
              </h2>
              <button
                onClick={() => {
                  setShowWeeklyDiaryModal(false)
                  setWeeklyDiarySummary(null)
                }}
                className="text-gray-400 hover:text-gray-600 text-4xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-800 font-sans leading-relaxed">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-3 text-gray-900 font-sans" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-4 mb-2 text-gray-900 font-sans" {...props} />,
                    h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-3 mb-2 text-gray-800 font-sans" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-2 text-gray-700 text-sm font-sans" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-700 text-sm font-sans" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-700 text-sm font-sans" {...props} />,
                    li: ({ node, ...props }) => <li className="ml-4 font-sans" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900 font-sans" {...props} />,
                  }}
                >
                  {weeklyDiarySummary.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
