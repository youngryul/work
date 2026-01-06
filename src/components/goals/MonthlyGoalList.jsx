/**
 * 월별 목표 리스트 컴포넌트
 * 월별 목표를 리스트 형태로 표시
 */
import { useState } from 'react'
import { MONTHLY_GOAL_STATUS } from '../../constants/goalCategories.js'
import { updateMonthlyGoal } from '../../services/goalService.js'

/**
 * @param {Array} goals - 월별 목표 목록
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {Function} onGoalClick - 목표 클릭 핸들러
 * @param {Function} onEdit - 수정 핸들러
 * @param {Function} onDelete - 삭제 핸들러
 * @param {Function} onUpdate - 업데이트 완료 핸들러
 */
export default function MonthlyGoalList({ goals, year, month, onGoalClick, onEdit, onDelete, onUpdate }) {
  const [updatingStatus, setUpdatingStatus] = useState({})

  const handleStatusToggle = async (goal, e) => {
    e.stopPropagation()
    
    const newStatus = goal.status === MONTHLY_GOAL_STATUS.COMPLETED 
      ? MONTHLY_GOAL_STATUS.IN_PROGRESS 
      : MONTHLY_GOAL_STATUS.COMPLETED

    setUpdatingStatus(prev => ({ ...prev, [goal.id]: true }))
    
    try {
      await updateMonthlyGoal(goal.id, {
        status: newStatus,
      })
      onUpdate?.()
    } catch (error) {
      console.error('상태 업데이트 실패:', error)
      alert('상태 업데이트에 실패했습니다.')
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [goal.id]: false }))
    }
  }
  if (!goals || goals.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 font-sans">
        <p className="text-base mb-2">등록된 월별 목표가 없습니다.</p>
        <p className="text-sm">연간 목표와 연결하여 월별 목표를 등록해보세요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {goals.map((goal) => (
        <div
          key={goal.id}
          className="bg-white rounded-lg border-2 border-gray-200 p-5 hover:border-pink-300 transition-all duration-200 cursor-pointer"
          onClick={() => onGoalClick?.(goal)}
        >
          {/* 헤더 */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-lg font-semibold text-gray-800 font-sans">{goal.title}</h4>
                {goal.yearlyGoal && (
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded font-sans">
                    {goal.yearlyGoal.title}
                  </span>
                )}
              </div>
              {goal.description && (
                <p className="text-sm text-gray-600 mb-2 font-sans">{goal.description}</p>
              )}
            </div>
            <div className="flex gap-2 ml-4">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit?.(goal)
                }}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors font-sans"
              >
                수정
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('정말 삭제하시겠습니까?')) {
                    onDelete?.(goal.id)
                  }
                }}
                className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors font-sans"
              >
                삭제
              </button>
            </div>
          </div>

          {/* 완료 여부 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={goal.status === MONTHLY_GOAL_STATUS.COMPLETED}
                  onChange={(e) => handleStatusToggle(goal, e)}
                  disabled={updatingStatus[goal.id]}
                  className="w-5 h-5 text-pink-600 border-gray-300 rounded focus:ring-pink-500 cursor-pointer disabled:opacity-50"
                />
                <span className={`text-sm font-medium font-sans ${
                  goal.status === MONTHLY_GOAL_STATUS.COMPLETED ? 'text-green-700' : 'text-gray-700'
                }`}>
                  {goal.status === MONTHLY_GOAL_STATUS.COMPLETED ? '완료' : '미완료'}
                </span>
              </label>
              {goal.status === MONTHLY_GOAL_STATUS.PAUSED && (
                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded font-sans">
                  보류
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500 font-sans">
              {goal.year}년 {goal.month}월
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

