/**
 * 연간 목표 입력/수정 폼 컴포넌트
 */
import { useState, useEffect } from 'react'
import { GOAL_CATEGORY, GOAL_CATEGORY_LABEL, GOAL_CATEGORY_ICON, MAX_YEARLY_GOALS } from '../../constants/goalCategories.js'
import { createYearlyGoal, updateYearlyGoal, getYearlyGoals } from '../../services/goalService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * @param {Object|null} initialGoal - 초기 목표 데이터 (수정 모드)
 * @param {number} year - 연도
 * @param {Function} onSave - 저장 완료 핸들러
 * @param {Function} onCancel - 취소 핸들러
 */
export default function YearlyGoalForm({ initialGoal = null, year = 2026, onSave, onCancel }) {
  const isEditMode = !!initialGoal
  const [existingGoals, setExistingGoals] = useState([])

  const [formData, setFormData] = useState({
    category: '',
    title: '',
    description: '',
    measurementCriteria: '',
    obstacles: '',
    strategy: '',
  })

  const [loading, setLoading] = useState(false)

  // 기존 목표 로드 (중복 확인용)
  useEffect(() => {
    loadExistingGoals()
  }, [year])

  // 초기 데이터 로드
  useEffect(() => {
    if (initialGoal) {
      setFormData({
        category: initialGoal.category,
        title: initialGoal.title,
        description: initialGoal.description || '',
        measurementCriteria: initialGoal.measurementCriteria || '',
        obstacles: initialGoal.obstacles || '',
        strategy: initialGoal.strategy || '',
      })
    }
  }, [initialGoal])

  const loadExistingGoals = async () => {
    try {
      const goals = await getYearlyGoals(year)
      setExistingGoals(goals)
    } catch (error) {
      console.error('기존 목표 로드 실패:', error)
    }
  }

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // 유효성 검사
    if (!formData.category) {
      showToast('영역을 선택해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (!formData.title.trim()) {
      showToast('목표 제목을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    // 중복 확인 (수정 모드가 아닐 때)
    if (!isEditMode) {
      const duplicate = existingGoals.find(g => g.category === formData.category)
      if (duplicate) {
        showToast('해당 영역에는 이미 목표가 등록되어 있습니다.', TOAST_TYPES.ERROR)
        return
      }
      if (existingGoals.length >= MAX_YEARLY_GOALS) {
        showToast(`연간 목표는 최대 ${MAX_YEARLY_GOALS}개까지 등록할 수 있습니다.`, TOAST_TYPES.ERROR)
        return
      }
    }

    try {
      setLoading(true)
      if (isEditMode) {
        await updateYearlyGoal(initialGoal.id, {
          ...formData,
          year,
        })
      } else {
        await createYearlyGoal({
          ...formData,
          year,
        })
      }
      onSave?.()
    } catch (error) {
      console.error('목표 저장 실패:', error)
      showToast(error.message || '목표 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  // 사용 가능한 영역 필터링
  const availableCategories = Object.values(GOAL_CATEGORY).filter(category => {
    if (isEditMode && initialGoal.category === category) return true
    return !existingGoals.find(g => g.category === category)
  })

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border-2 border-pink-200 p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 font-sans">
            {isEditMode ? '연간 목표 수정' : '연간 목표 등록'}
          </h1>
          <p className="text-base text-gray-600 font-sans">
            {year}년 목표를 설계하세요. 목표는 적는 것이 아니라 설계하는 것입니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 영역 선택 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              목표 영역 *
            </label>
            <div className="grid grid-cols-5 gap-3">
              {Object.values(GOAL_CATEGORY).map((category) => {
                const isSelected = formData.category === category
                const isDisabled = !isEditMode && !availableCategories.includes(category)
                const icon = GOAL_CATEGORY_ICON[category]
                const label = GOAL_CATEGORY_LABEL[category]

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => !isDisabled && updateField('category', category)}
                    disabled={isDisabled}
                    className={`p-4 rounded-lg border-2 transition-all font-sans ${
                      isSelected
                        ? 'border-pink-400 bg-pink-50'
                        : isDisabled
                        ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-pink-300 hover:bg-pink-50'
                    }`}
                  >
                    <div className="text-2xl mb-1">{icon}</div>
                    <div className="text-sm font-medium">{label}</div>
                    {isDisabled && !isEditMode && (
                      <div className="text-xs text-gray-400 mt-1">등록됨</div>
                    )}
                  </button>
                )
              })}
            </div>
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
              placeholder="예: 건강한 생활 습관 만들기"
              required
              className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
            />
          </div>

          {/* 목표 설명 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              목표 설명 (왜 중요한지)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="이 목표가 왜 중요한지, 달성하면 어떤 변화가 있을지 작성해주세요..."
              rows={4}
              className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans resize-none"
            />
          </div>

          {/* 측정 기준 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              측정 기준 (정량/정성)
            </label>
            <textarea
              value={formData.measurementCriteria}
              onChange={(e) => updateField('measurementCriteria', e.target.value)}
              placeholder="예: 주 3회 운동, 체중 5kg 감량, 또는 '스트레스 감소 느낌' 등..."
              rows={3}
              className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans resize-none"
            />
          </div>

          {/* 방해 요소 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              방해 요소
            </label>
            <textarea
              value={formData.obstacles}
              onChange={(e) => updateField('obstacles', e.target.value)}
              placeholder="목표 달성을 방해할 수 있는 요소들을 미리 생각해보세요..."
              rows={3}
              className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans resize-none"
            />
          </div>

          {/* 대응 전략 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              대응 전략
            </label>
            <textarea
              value={formData.strategy}
              onChange={(e) => updateField('strategy', e.target.value)}
              placeholder="방해 요소에 대한 대응 전략을 구체적으로 작성해주세요..."
              rows={3}
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

