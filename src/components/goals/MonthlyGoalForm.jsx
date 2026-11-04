/**
 * 월별 목표 입력/수정 폼 컴포넌트
 * 목표 제목만 입력 (연간 목표 연결 · 목표 설명은 사용하지 않음)
 */
import { useState, useEffect } from 'react'
import { createMonthlyGoal, updateMonthlyGoal, getMonthlyGoals, createHabitTracker } from '../../services/goalService.js'
import { MONTHLY_GOAL_STATUS, MAX_MONTHLY_GOALS } from '../../constants/goalCategories.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * @param {Object|null} initialGoal - 초기 목표 데이터 (수정 모드)
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {Function} onSave - 저장 완료 핸들러
 * @param {Function} onCancel - 취소 핸들러
 */
export default function MonthlyGoalForm({ initialGoal = null, year, month, onSave, onCancel }) {
  const isEditMode = !!initialGoal
  const [existingGoals, setExistingGoals] = useState([])
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState(MONTHLY_GOAL_STATUS.IN_PROGRESS)
  // 등록 시 이 목표 아래에 습관 트래커를 함께 만들지 여부
  const [needsHabitTracker, setNeedsHabitTracker] = useState(false)
  const [loading, setLoading] = useState(false)

  // 기존 월별 목표 로드 (최대 개수 확인용)
  useEffect(() => {
    getMonthlyGoals(year, month)
      .then(setExistingGoals)
      .catch((error) => console.error('데이터 로드 실패:', error))
  }, [year, month])

  // 수정 모드 초기값
  useEffect(() => {
    setTitle(initialGoal?.title || '')
    setStatus(initialGoal?.status || MONTHLY_GOAL_STATUS.IN_PROGRESS)
  }, [initialGoal])

  const handleSubmit = async (e) => {
    e.preventDefault()

    const trimmed = title.trim()
    if (!trimmed) {
      showToast('목표 제목을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    // 최대 개수 확인 (수정 모드가 아닐 때)
    if (!isEditMode && existingGoals.length >= MAX_MONTHLY_GOALS) {
      showToast(`월별 목표는 최대 ${MAX_MONTHLY_GOALS}개까지 등록할 수 있습니다.`, TOAST_TYPES.ERROR)
      return
    }

    try {
      setLoading(true)
      if (isEditMode) {
        // 제목·상태만 수정 (기존에 저장된 연간 목표 연결·설명은 건드리지 않음)
        await updateMonthlyGoal(initialGoal.id, { title: trimmed, status })
      } else {
        const created = await createMonthlyGoal({ title: trimmed, year, month })
        if (needsHabitTracker) {
          await createHabitTracker({
            monthlyGoalId: created.id,
            year,
            month,
            title: trimmed,
          })
        }
      }
      onSave?.()
    } catch (error) {
      console.error('목표 저장 실패:', error)
      showToast(error.message || '목표 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border-2 border-green-200 p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 font-sans">
            {isEditMode ? '월별 목표 수정' : '월별 목표 등록'}
          </h1>
          <p className="text-base text-gray-600 font-sans">
            {year}년 {month}월 목표를 등록하세요. 매일 할 일이 있는 목표라면 습관 트래커를 함께 만들어보세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 목표 제목 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              목표 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 주 3회 운동하기"
              required
              autoFocus
              className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans"
            />
          </div>

          {/* 습관 트래커 함께 만들기 (등록 모드에서만) */}
          {!isEditMode && (
            <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-amber-200 bg-amber-50/60 cursor-pointer">
              <input
                type="checkbox"
                checked={needsHabitTracker}
                onChange={(e) => setNeedsHabitTracker(e.target.checked)}
                className="mt-1 w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <span className="font-sans">
                <span className="block text-base font-medium text-gray-800">습관 트래커가 필요해요</span>
                <span className="block text-sm text-gray-600">
                  목표 바로 아래에 1일~말일 체크 트래커가 생겨요. 습관 이름은 트래커 제목을 눌러 바꿀 수 있어요.
                </span>
              </span>
            </label>
          )}

          {/* 완료 여부 (수정 모드에서만) */}
          {isEditMode && (
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                완료 여부
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans"
              >
                <option value={MONTHLY_GOAL_STATUS.IN_PROGRESS}>진행 중</option>
                <option value={MONTHLY_GOAL_STATUS.COMPLETED}>완료</option>
                <option value={MONTHLY_GOAL_STATUS.PAUSED}>보류</option>
              </select>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-4 justify-end pt-4 border-t-2 border-green-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border-2 border-green-200 rounded-lg text-gray-700 hover:bg-green-50 transition-colors text-base font-medium shadow-md font-sans"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-base font-medium shadow-md font-sans disabled:opacity-50"
            >
              {loading ? '저장 중...' : isEditMode ? '수정' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
