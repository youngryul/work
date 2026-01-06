import { useState, useEffect } from 'react'
import { getAnswersByYear, getQuestionByDate, getAnswersByQuestion } from '../services/fiveYearQuestionService.js'

/**
 * 날짜를 day_of_year로 변환
 * @param {Date} date - 날짜 객체
 * @returns {number} day_of_year (1-365)
 */
function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date - start
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

/**
 * 5년 질문 일기 대시보드 컴포넌트
 * 연간 전체 달력으로 답변 여부를 한눈에 확인하고, 각 날짜의 5년치 답변을 모두 볼 수 있음
 */
export default function FiveYearQuestionDashboard({ onDateClick }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [allAnswers, setAllAnswers] = useState({}) // { day_of_year: { [year]: answer } }
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedDateAnswers, setSelectedDateAnswers] = useState([])
  const [selectedDateQuestion, setSelectedDateQuestion] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // 최근 5년간의 답변 데이터 로드
  useEffect(() => {
    const loadAllAnswers = async () => {
      setIsLoading(true)
      try {
        const currentYear = new Date().getFullYear()
        const answerMap = {} // { day_of_year: { [year]: answer } }

        // 최근 5년간의 데이터를 모두 로드
        for (let year = currentYear; year >= currentYear - 4; year--) {
          try {
            const answers = await getAnswersByYear(year)
            
            // 각 답변을 day_of_year별로 그룹화
            answers.forEach(answer => {
              if (answer.five_year_questions?.day_of_year) {
                const dayOfYear = answer.five_year_questions.day_of_year
                if (!answerMap[dayOfYear]) {
                  answerMap[dayOfYear] = {}
                }
                answerMap[dayOfYear][year] = answer
              }
            })
          } catch (err) {
            console.error(`연도 ${year} 데이터 로드 실패:`, err)
          }
        }

        setAllAnswers(answerMap)
      } catch (error) {
        console.error('답변 로드 오류:', error)
        alert('데이터를 불러오는데 실패했습니다.')
      } finally {
        setIsLoading(false)
      }
    }

    loadAllAnswers()
  }, [selectedYear])

  /**
   * 특정 날짜에 대한 5년치 답변 개수 확인
   */
  const getAnswerCount = (date) => {
    const dayOfYear = getDayOfYear(date)
    const answers = allAnswers[dayOfYear] || {}
    return Object.keys(answers).length
  }

  /**
   * 특정 날짜에 대한 5년치 답변 연도 목록
   */
  const getAnswerYears = (date) => {
    const dayOfYear = getDayOfYear(date)
    const answers = allAnswers[dayOfYear] || {}
    return Object.keys(answers).map(y => Number(y)).sort((a, b) => b - a)
  }

  /**
   * 날짜 클릭 핸들러 - 5년치 답변 상세 보기
   */
  const handleDateClick = async (date) => {
    setSelectedDate(date)
    const dayOfYear = getDayOfYear(date)
    const answers = allAnswers[dayOfYear] || {}
    
    // 질문 조회
    try {
      const question = await getQuestionByDate(date)
      setSelectedDateQuestion(question)
      
      // 답변 목록 정리
      const answerList = Object.entries(answers)
        .map(([year, answer]) => ({
          year: Number(year),
          ...answer
        }))
        .sort((a, b) => b.year - a.year)
      
      setSelectedDateAnswers(answerList)
      setShowDetailModal(true)
    } catch (error) {
      console.error('질문 조회 오류:', error)
      alert('질문을 불러오는데 실패했습니다.')
    }
  }

  /**
   * 달력 렌더링 (전체 연도)
   */
  const renderYearCalendar = () => {
    const months = []
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
    const weekDays = ['일', '월', '화', '수', '목', '금', '토']
    const today = new Date()

    for (let month = 1; month <= 12; month++) {
      const firstDay = new Date(selectedYear, month - 1, 1)
      const lastDay = new Date(selectedYear, month, 0)
      const daysInMonth = lastDay.getDate()
      const startingDayOfWeek = firstDay.getDay()

      const weeks = []
      let currentWeek = []

      // 첫 주의 빈 칸
      for (let i = 0; i < startingDayOfWeek; i++) {
        currentWeek.push(null)
      }

      // 날짜 셀 생성
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(selectedYear, month - 1, day)
        const isToday = 
          date.getFullYear() === today.getFullYear() &&
          date.getMonth() === today.getMonth() &&
          date.getDate() === today.getDate()
        const answerCount = getAnswerCount(date)
        const maxYears = 5

        currentWeek.push({
          day,
          date,
          isToday,
          answerCount,
          answerYears: getAnswerYears(date),
        })

        // 주가 끝나면 다음 주로
        if (currentWeek.length === 7) {
          weeks.push([...currentWeek])
          currentWeek = []
        }
      }

      // 마지막 주의 빈 칸
      while (currentWeek.length < 7) {
        currentWeek.push(null)
      }
      if (currentWeek.some(cell => cell !== null)) {
        weeks.push(currentWeek)
      }

      months.push({
        month,
        name: monthNames[month - 1],
        weeks,
      })
    }

    return months
  }

  /**
   * 통계 계산
   */
  const stats = {
    total: Object.values(allAnswers).reduce((sum, answers) => sum + Object.keys(answers).length, 0),
    totalDays: Object.keys(allAnswers).length,
    byYear: (() => {
      const yearMap = {}
      Object.values(allAnswers).forEach(answers => {
        Object.keys(answers).forEach(year => {
          yearMap[year] = (yearMap[year] || 0) + 1
        })
      })
      return yearMap
    })(),
  }

  const months = renderYearCalendar()
  const weekDays = ['일', '월', '화', '수', '목', '금', '토']

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-2xl text-gray-500 font-sans">로딩 중...</div>
      </div>
    )
  }

  // 2026년 답변 수 계산
  const answerCount2026 = stats.byYear['2026'] || 0

  return (
    <div className="space-y-6">
      {/* 2026년 답변 수 */}
      <div className="text-sm text-gray-500 font-sans">
        2026년 총 <span className="font-semibold text-pink-600">{answerCount2026}</span>개 답변
      </div>

      {/* 전체 연도 달력 */}
      <div className="space-y-8">
        {months.map(({ month, name, weeks }) => (
          <div key={month} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4 font-sans">{name}</h3>
            
            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-semibold text-gray-600 py-1 font-sans"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 달력 그리드 */}
            <div className="space-y-1">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 gap-1">
                  {week.map((cell, cellIndex) => {
                    if (!cell) {
                      return <div key={cellIndex} className="aspect-square" />
                    }

                    const { day, date, isToday, answerCount, answerYears } = cell
                    const maxYears = 5
                    const percentage = (answerCount / maxYears) * 100

                    return (
                      <button
                        key={cellIndex}
                        onClick={() => handleDateClick(date)}
                        className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-all duration-200 relative cursor-pointer ${
                          isToday
                            ? 'bg-pink-200 border-2 border-pink-400 shadow-md'
                            : answerCount > 0
                            ? 'bg-pink-100 border border-pink-300 hover:bg-pink-200 hover:shadow-md'
                            : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                        }`}
                        title={`${answerCount}년 답변: ${answerYears.join(', ')}년`}
                      >
                        <span
                          className={`text-xs font-medium ${
                            isToday
                              ? 'text-pink-700'
                              : answerCount > 0
                              ? 'text-pink-600'
                              : 'text-gray-500'
                          }`}
                        >
                          {day}
                        </span>
                        {answerCount > 0 && (
                          <div className="absolute bottom-1 left-1 right-1">
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div
                                className="bg-pink-500 h-1 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-[8px] text-gray-600 mt-0.5 block">
                              {answerCount}/5
                            </span>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
        <div className="flex items-center justify-center gap-6 text-sm font-sans">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-pink-100 border border-pink-300 rounded"></div>
            <span className="text-gray-600">답변 있음 (하단에 년도 표시)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
            <span className="text-gray-600">답변 없음</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-pink-200 border-2 border-pink-400 rounded"></div>
            <span className="text-gray-600">오늘</span>
          </div>
        </div>
      </div>

      {/* 날짜별 5년치 답변 상세 모달 */}
      {showDetailModal && selectedDate && selectedDateQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 font-sans">
                    {selectedDate.toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long'
                    })}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 font-sans">
                    {selectedDateAnswers.length}년간의 답변
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            {/* 질문 */}
            <div className="p-6 bg-gradient-to-r from-pink-50 to-purple-50 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-700 mb-2 font-sans">질문</h4>
              <p className="text-base text-gray-800 font-sans">{selectedDateQuestion.question_text}</p>
            </div>

            {/* 답변 목록 */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedDateAnswers.length > 0 ? (
                <div className="space-y-4">
                  {selectedDateAnswers.map((answer) => {
                    const currentYear = new Date().getFullYear()
                    const isCurrentYear = answer.year === currentYear
                    const yearDiff = currentYear - answer.year
                    const yearLabel = yearDiff === 0 ? '올해' : yearDiff === 1 ? '작년' : `${yearDiff}년 전`

                    return (
                      <div
                        key={answer.id}
                        className={`p-4 rounded-lg border-2 ${
                          isCurrentYear
                            ? 'bg-pink-50 border-pink-300 shadow-md'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-lg font-bold ${
                              isCurrentYear ? 'text-pink-600' : 'text-gray-600'
                            }`}>
                              {answer.year}년
                            </span>
                            <span className="text-sm text-gray-500">({yearLabel})</span>
                            {isCurrentYear && (
                              <span className="px-2 py-1 bg-pink-200 text-pink-700 rounded text-xs font-semibold">
                                올해
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-base text-gray-700 font-sans leading-relaxed whitespace-pre-wrap">
                          {answer.content}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 font-sans">
                  아직 답변이 없습니다.
                </div>
              )}
            </div>

            {/* 푸터 */}
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  if (onDateClick) {
                    onDateClick(selectedDate)
                  }
                }}
                className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors font-sans"
              >
                질문 답변 페이지로 이동
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
