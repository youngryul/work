/**
 * 목표 관리 대시보드 메인 컴포넌트
 * 연간 목표, 월별 목표, 일간 체크리스트를 통합 관리
 */
import { useState, useEffect } from 'react'
import YearlyGoalCard from './YearlyGoalCard.jsx'
import YearlyGoalForm from './YearlyGoalForm.jsx'
import MonthlyGoalList from './MonthlyGoalList.jsx'
import MonthlyGoalForm from './MonthlyGoalForm.jsx'
import MonthlyReflectionForm from './MonthlyReflectionForm.jsx'
import {
  getYearlyGoals,
  getMonthlyGoals,
  deleteYearlyGoal,
  deleteMonthlyGoal,
  canCreateNextMonthGoals,
} from '../../services/goalService.js'
import { GOAL_CATEGORY, MAX_YEARLY_GOALS, MAX_MONTHLY_GOALS } from '../../constants/goalCategories.js'

const CURRENT_YEAR = 2026

export default function GoalsDashboard() {
  const [yearlyGoals, setYearlyGoals] = useState([])
  const [monthlyGoals, setMonthlyGoals] = useState([])
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [currentYear] = useState(CURRENT_YEAR)
  const [selectedView, setSelectedView] = useState('dashboard') // dashboard, monthly, reflection
  const [goalFormView, setGoalFormView] = useState(null) // 'yearly' | 'monthly' | null
  const [editingGoal, setEditingGoal] = useState(null)
  const [loading, setLoading] = useState(false)

  // 데이터 로드
  useEffect(() => {
    loadData()
  }, [currentYear, currentMonth])

  const loadData = async () => {
    try {
      setLoading(true)
      const [yearly, monthly] = await Promise.all([
        getYearlyGoals(currentYear),
        getMonthlyGoals(currentYear, currentMonth),
      ])
      setYearlyGoals(yearly)
      setMonthlyGoals(monthly)
    } catch (error) {
      console.error('데이터 로드 실패:', error)
      alert('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 월 변경
  const handleMonthChange = (month) => {
    setCurrentMonth(month)
  }

  // 연간 목표 삭제
  const handleDeleteYearlyGoal = async (id) => {
    try {
      await deleteYearlyGoal(id)
      await loadData()
    } catch (error) {
      console.error('연간 목표 삭제 실패:', error)
      alert('목표 삭제에 실패했습니다.')
    }
  }

  // 월별 목표 삭제
  const handleDeleteMonthlyGoal = async (id) => {
    try {
      await deleteMonthlyGoal(id)
      await loadData()
    } catch (error) {
      console.error('월별 목표 삭제 실패:', error)
      alert('목표 삭제에 실패했습니다.')
    }
  }

  // 목표 저장 완료
  const handleGoalSave = () => {
    setGoalFormView(null)
    setEditingGoal(null)
    loadData()
  }

  // 목표 폼 취소
  const handleGoalCancel = () => {
    setGoalFormView(null)
    setEditingGoal(null)
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500 font-sans">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400 mx-auto mb-4"></div>
        <p>로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 font-sans">
          {currentYear}년 목표 관리
        </h1>
        <p className="text-base text-gray-600 font-sans">
          목표는 적는 것이 아니라 설계하는 것입니다. 행동과 회고를 통해 목표를 달성하세요.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-2 border-b-2 border-pink-200 mb-6">
        <button
          onClick={() => setSelectedView('dashboard')}
          className={`px-6 py-3 text-base font-medium font-sans transition-colors ${
            selectedView === 'dashboard'
              ? 'border-b-2 border-pink-400 text-pink-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          대시보드
        </button>
        <button
          onClick={() => setSelectedView('monthly')}
          className={`px-6 py-3 text-base font-medium font-sans transition-colors ${
            selectedView === 'monthly'
              ? 'border-b-2 border-pink-400 text-pink-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          월별 목표
        </button>
        <button
          onClick={() => setSelectedView('reflection')}
          className={`px-6 py-3 text-base font-medium font-sans transition-colors ${
            selectedView === 'reflection'
              ? 'border-b-2 border-pink-400 text-pink-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          회고
        </button>
      </div>

      {/* 목표 입력 폼 뷰 */}
      {goalFormView === 'yearly' && (
        <YearlyGoalForm
          initialGoal={editingGoal}
          year={currentYear}
          onSave={handleGoalSave}
          onCancel={handleGoalCancel}
        />
      )}

      {goalFormView === 'monthly' && (
        <MonthlyGoalForm
          initialGoal={editingGoal}
          year={currentYear}
          month={currentMonth}
          onSave={handleGoalSave}
          onCancel={handleGoalCancel}
        />
      )}

      {/* 메인 뷰 */}
      {!goalFormView && (
        <>
      {/* 대시보드 뷰 */}
      {selectedView === 'dashboard' && (
        <div className="space-y-6">
          {/* 연간 목표 영역 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800 font-sans">연간 목표</h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 font-sans">
                  {yearlyGoals.length} / {MAX_YEARLY_GOALS}
                </span>
                {yearlyGoals.length < MAX_YEARLY_GOALS && (
                  <button
                    onClick={() => {
                      setEditingGoal(null)
                      setGoalFormView('yearly')
                    }}
                    className="px-4 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors text-sm font-medium shadow-md font-sans"
                  >
                    + 연간 목표 추가
                  </button>
                )}
              </div>
            </div>
            {yearlyGoals.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-base text-gray-500 mb-2 font-sans">등록된 연간 목표가 없습니다.</p>
                <p className="text-sm text-gray-400 font-sans">새해 목표를 등록해보세요.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {yearlyGoals.map((goal) => (
                  <YearlyGoalCard
                    key={goal.id}
                    goal={goal}
                    onClick={() => setSelectedView('monthly')}
                    onEdit={(goal) => {
                      setEditingGoal(goal)
                      setGoalFormView('yearly')
                    }}
                    onDelete={handleDeleteYearlyGoal}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 월별 목표 뷰 */}
      {selectedView === 'monthly' && (
        <div className="space-y-6">
          {/* 월 선택 */}
          <div className="flex items-center gap-4 mb-6">
            <label className="text-base font-medium text-gray-700 font-sans">월 선택:</label>
            <select
              value={currentMonth}
              onChange={(e) => handleMonthChange(parseInt(e.target.value))}
              className="px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {month}월
                </option>
              ))}
            </select>
          </div>

          {/* 월별 목표 리스트 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800 font-sans">
                {currentMonth}월 목표
              </h2>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 font-sans">
                  {monthlyGoals.length} / {MAX_MONTHLY_GOALS}
                </span>
                {monthlyGoals.length < MAX_MONTHLY_GOALS && yearlyGoals.length > 0 && (
                  <button
                    onClick={() => {
                      // 회고 작성 확인
                      canCreateNextMonthGoals(currentYear, currentMonth - 1).then(canCreate => {
                        if (currentMonth > 1 && !canCreate) {
                          alert('이전 달 회고를 먼저 작성해주세요.')
                          return
                        }
                        setEditingGoal(null)
                        setGoalFormView('monthly')
                      }).catch(() => {
                        setEditingGoal(null)
                        setGoalFormView('monthly')
                      })
                    }}
                    className="px-4 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors text-sm font-medium shadow-md font-sans"
                  >
                    + 월별 목표 추가
                  </button>
                )}
              </div>
            </div>
            <MonthlyGoalList
              goals={monthlyGoals}
              onEdit={(goal) => {
                setEditingGoal(goal)
                setGoalFormView('monthly')
              }}
              onDelete={handleDeleteMonthlyGoal}
            />
          </div>
        </div>
      )}

      {/* 회고 뷰 */}
      {selectedView === 'reflection' && (
        <div>
          <MonthlyReflectionForm
            year={currentYear}
            month={currentMonth}
            onSave={loadData}
          />
        </div>
      )}
        </>
      )}
    </div>
  )
}

