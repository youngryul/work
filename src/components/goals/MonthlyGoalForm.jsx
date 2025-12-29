/**
 * 월별 목표 입력/수정 폼 컴포넌트
 */
import { useState, useEffect } from 'react'
import { getYearlyGoals, createMonthlyGoal, updateMonthlyGoal, getMonthlyGoals } from '../../services/goalService.js'
import { MONTHLY_GOAL_STATUS, MAX_MONTHLY_GOALS } from '../../constants/goalCategories.js'

/**
 * @param {Object|null} initialGoal - 초기 목표 데이터 (수정 모드)
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {Function} onSave - 저장 완료 핸들러
 * @param {Function} onCancel - 취소 핸들러
 */
export default function MonthlyGoalForm({ initialGoal = null, year, month, onSave, onCancel }) {
  const isEditMode = !!initialGoal
  const [yearlyGoals, setYearlyGoals] = useState([])
  const [existingGoals, setExistingGoals] = useState([])

  const [formData, setFormData] = useState({
    yearlyGoalId: '',
    title: '',
    description: '',
  })

  const [loading, setLoading] = useState(false)

  // 연간 목표 및 기존 월별 목표 로드
  useEffect(() => {
    loadData()
  }, [year, month])

  // 초기 데이터 로드
  useEffect(() => {
    if (initialGoal) {
      setFormData({
        yearlyGoalId: initialGoal.yearlyGoalId,
        title: initialGoal.title,
        description: initialGoal.description || '',
      })
    }
  }, [initialGoal])

  const loadData = async () => {
    try {
      const [yearly, monthly] = await Promise.all([
        getYearlyGoals(year),
        getMonthlyGoals(year, month),
      ])
      setYearlyGoals(yearly)
      setExistingGoals(monthly)
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    }
  }

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // 유효성 검사
    if (!formData.yearlyGoalId) {
      alert('연간 목표를 선택해주세요.')
      return
    }
    if (!formData.title.trim()) {
      alert('목표 제목을 입력해주세요.')
      return
    }

    // 최대 개수 확인 (수정 모드가 아닐 때)
    if (!isEditMode && existingGoals.length >= MAX_MONTHLY_GOALS) {
      alert(`월별 목표는 최대 ${MAX_MONTHLY_GOALS}개까지 등록할 수 있습니다.`)
      return
    }

    try {
      setLoading(true)
      if (isEditMode) {
        await updateMonthlyGoal(initialGoal.id, {
          ...formData,
          year,
          month,
        })
      } else {
        await createMonthlyGoal({
          ...formData,
          year,
          month,
        })
      }
      onSave?.()
    } catch (error) {
      console.error('목표 저장 실패:', error)
      alert(error.message || '목표 저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border-2 border-pink-200 p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 font-sans">
            {isEditMode ? '월별 목표 수정' : '월별 목표 등록'}
          </h1>
          <p className="text-base text-gray-600 font-sans">
            {year}년 {month}월 목표를 등록하세요. 연간 목표와 연결하여 구체적인 행동 계획을 세워보세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 연간 목표 선택 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              연간 목표 선택 *
            </label>
            <select
              value={formData.yearlyGoalId}
              onChange={(e) => updateField('yearlyGoalId', e.target.value)}
              required
              disabled={isEditMode}
              className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans disabled:bg-gray-100"
            >
              <option value="">연간 목표를 선택하세요</option>
              {yearlyGoals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
            {yearlyGoals.length === 0 && (
              <p className="text-sm text-gray-500 mt-2 font-sans">
                먼저 연간 목표를 등록해주세요.
              </p>
            )}
          </div>

          {/* 목표 제목 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              목표 제목 *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="예: 주 3회 운동하기"
              required
              className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
            />
          </div>

          {/* 목표 설명 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              목표 설명
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="이번 달 목표에 대한 구체적인 설명을 작성해주세요..."
              rows={4}
              className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans resize-none"
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-4 justify-end pt-4 border-t-2 border-pink-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border-2 border-pink-200 rounded-lg text-gray-700 hover:bg-pink-50 transition-colors text-base font-medium shadow-md font-sans"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors text-base font-medium shadow-md font-sans disabled:opacity-50"
            >
              {loading ? '저장 중...' : isEditMode ? '수정' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

