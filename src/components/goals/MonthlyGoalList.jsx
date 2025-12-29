/**
 * 월별 목표 리스트 컴포넌트
 * 월별 목표를 리스트 형태로 표시
 */
import { MONTHLY_GOAL_STATUS_LABEL } from '../../constants/goalCategories.js'

/**
 * @param {Array} goals - 월별 목표 목록
 * @param {Function} onGoalClick - 목표 클릭 핸들러
 * @param {Function} onEdit - 수정 핸들러
 * @param {Function} onDelete - 삭제 핸들러
 */
export default function MonthlyGoalList({ goals, onGoalClick, onEdit, onDelete }) {
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

          {/* 진행률 */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600 font-sans">진행률</span>
              <span className="text-xs font-bold text-gray-800 font-sans">{goal.progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-pink-400 h-2 rounded-full transition-all duration-300"
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
              {MONTHLY_GOAL_STATUS_LABEL[goal.status] || goal.status}
            </span>
            <span className="text-xs text-gray-500 font-sans">
              {goal.year}년 {goal.month}월
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

