/**
 * 연간 목표 카드 컴포넌트
 * 영역별 목표를 카드 형태로 표시
 */
import { GOAL_CATEGORY_ICON, GOAL_CATEGORY_LABEL, GOAL_CATEGORY_COLOR, GOAL_STATUS_LABEL } from '../../constants/goalCategories.js'

/**
 * @param {Object} goal - 연간 목표 데이터
 * @param {Function} onClick - 클릭 핸들러
 * @param {Function} onEdit - 수정 핸들러
 * @param {Function} onDelete - 삭제 핸들러
 */
export default function YearlyGoalCard({ goal, onClick, onEdit, onDelete }) {
  const categoryColor = GOAL_CATEGORY_COLOR[goal.category] || 'bg-gray-100 text-gray-800 border-gray-300'
  const categoryIcon = GOAL_CATEGORY_ICON[goal.category] || '📌'
  const categoryLabel = GOAL_CATEGORY_LABEL[goal.category] || goal.category

  return (
    <div
      className={`bg-white rounded-lg shadow-md border-2 ${categoryColor} p-6 hover:shadow-lg transition-all duration-200 cursor-pointer`}
      onClick={onClick}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{categoryIcon}</span>
          <div>
            <h3 className="text-xl font-bold text-gray-800 font-sans">{goal.title}</h3>
            <p className="text-sm text-gray-600 font-sans">{categoryLabel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.(goal)
            }}
            className="px-3 py-1 text-sm bg-white/80 text-gray-700 rounded hover:bg-white transition-colors font-sans"
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
            className="px-3 py-1 text-sm bg-white/80 text-red-600 rounded hover:bg-white transition-colors font-sans"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 설명 */}
      {goal.description && (
        <p className="text-sm text-gray-700 mb-4 line-clamp-2 font-sans">{goal.description}</p>
      )}

      {/* 진행률 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 font-sans">진행률</span>
          <span className="text-sm font-bold text-gray-800 font-sans">{goal.progressPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${goal.progressPercentage}%` }}
          />
        </div>
      </div>

      {/* 상태 */}
      <div className="flex items-center justify-between">
        <span className={`px-2 py-1 text-xs rounded font-sans ${
          goal.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
          goal.status === 'PAUSED' ? 'bg-gray-100 text-gray-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {GOAL_STATUS_LABEL[goal.status] || goal.status}
        </span>
        {goal.measurementCriteria && (
          <span className="text-xs text-gray-500 font-sans">측정: {goal.measurementCriteria.substring(0, 20)}...</span>
        )}
      </div>
    </div>
  )
}

