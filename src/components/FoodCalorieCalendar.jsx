import { useState, useEffect } from 'react'
import { getCalorieSummary, getUserInfo, calculateDailyCalories } from '../services/foodCalorieService.js'

/**
 * 음식 칼로리 달력 컴포넌트
 * 각 날짜별로 총 칼로리를 표시하고 권장 칼로리 초과 여부를 이모티콘으로 표시
 */
export default function FoodCalorieCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calorieData, setCalorieData] = useState({}) // { 'YYYY-MM-DD': { totalCalories, dailyCalories } }
  const [isLoading, setIsLoading] = useState(true)
  const [dailyCalories, setDailyCalories] = useState(null) // 하루 권장 칼로리

  /**
   * 사용자 정보 로드 및 권장 칼로리 계산
   */
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const userInfo = await getUserInfo()
        if (userInfo.age && userInfo.gender && userInfo.height && userInfo.weight) {
          const recommended = calculateDailyCalories(
            userInfo.age,
            userInfo.gender,
            userInfo.height,
            userInfo.weight,
            userInfo.activityLevel || 'moderate'
          )
          setDailyCalories(recommended)
        }
      } catch (error) {
        console.error('사용자 정보 로드 오류:', error)
      }
    }
    loadUserInfo()
  }, [])

  /**
   * 해당 월의 칼로리 데이터 로드
   */
  const loadCalorieData = async () => {
    setIsLoading(true)
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      
      // 해당 월의 첫 날과 마지막 날
      const firstDay = new Date(year, month - 1, 1)
      const lastDay = new Date(year, month, 0)
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`

      // 각 날짜별로 칼로리 합계 조회
      const dataMap = {}
      const daysInMonth = lastDay.getDate()
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        try {
          const summary = await getCalorieSummary(dateString, dateString)
          if (summary.recordCount > 0) {
            dataMap[dateString] = {
              totalCalories: summary.totalCalories,
              dailyCalories: dailyCalories,
            }
          }
        } catch (error) {
          console.error(`칼로리 데이터 로드 오류 (${dateString}):`, error)
        }
      }
      
      setCalorieData(dataMap)
    } catch (error) {
      console.error('칼로리 데이터 로드 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (dailyCalories !== null) {
      loadCalorieData()
    }
  }, [currentDate, dailyCalories])

  /**
   * 이전 달로 이동
   */
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  /**
   * 다음 달로 이동
   */
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  /**
   * 오늘로 이동
   */
  const handleToday = () => {
    setCurrentDate(new Date())
  }

  /**
   * 달력 그리드 생성
   */
  const generateCalendar = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    // 해당 월의 첫 날과 마지막 날
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const calendar = []
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']

    // 요일 헤더
    calendar.push(
      <div key="header" className="grid grid-cols-7 gap-1 mb-2">
        {weekdays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-semibold text-gray-600 py-2"
          >
            {day}
          </div>
        ))}
      </div>
    )

    // 날짜 그리드
    const days = []

    // 첫 주의 빈 칸
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />)
    }

    // 날짜 칸
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const data = calorieData[dateString]
      const totalCalories = data?.totalCalories || 0
      const isToday =
        year === new Date().getFullYear() &&
        month === new Date().getMonth() &&
        day === new Date().getDate()

      // 권장 칼로리 초과 여부 확인
      const isOverLimit = dailyCalories && totalCalories > dailyCalories
      const emoji = totalCalories > 0 ? (isOverLimit ? '😢' : '😊') : null

      days.push(
        <div
          key={day}
          className={`aspect-square border-2 rounded-lg p-2 cursor-pointer hover:bg-green-50 transition-colors ${
            isToday ? 'border-green-400 bg-green-50' : 'border-gray-200'
          }`}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <div className={`text-sm font-medium mb-1 ${isToday ? 'text-green-600' : 'text-gray-700'}`}>
              {day}
            </div>
            {totalCalories > 0 && (
              <>
                <div className="text-xs text-gray-600 mb-1">
                  {totalCalories.toLocaleString()} kcal
                </div>
                {emoji && (
                  <div className="text-xl">{emoji}</div>
                )}
              </>
            )}
          </div>
        </div>
      )
    }

    calendar.push(
      <div key="days" className="grid grid-cols-7 gap-1">
        {days}
      </div>
    )

    return calendar
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-handwriting text-gray-800 mb-2">
          음식 칼로리 달력
        </h1>
        <p className="text-xl text-gray-600">
          날짜별 총 칼로리를 확인하고 권장 칼로리 초과 여부를 확인해보세요
        </p>
        {dailyCalories && (
          <p className="text-sm text-gray-500 mt-2">
            하루 권장 칼로리: <span className="font-semibold">{dailyCalories.toLocaleString()} kcal</span>
          </p>
        )}
      </div>

      {/* 달력 컨트롤 */}
      <div className="flex justify-between items-center mb-6 bg-white rounded-lg shadow-md p-4">
        <button
          onClick={handlePrevMonth}
          className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-semibold"
        >
          ← 이전 달
        </button>
        <h2 className="text-2xl font-handwriting text-gray-800">
          {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleToday}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold"
          >
            오늘
          </button>
          <button
            onClick={handleNextMonth}
            className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-semibold"
          >
            다음 달 →
          </button>
        </div>
      </div>

      {/* 달력 */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500 text-xl">로딩 중...</div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6">
          {generateCalendar()}
          
          {/* 범례 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl">😊</span>
                <span className="text-gray-600">권장 칼로리 이하</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl">😢</span>
                <span className="text-gray-600">권장 칼로리 초과</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!dailyCalories && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ 사용자 정보(나이, 성별, 키, 몸무게)를 입력하면 하루 권장 칼로리가 표시됩니다.
          </p>
        </div>
      )}
    </div>
  )
}
