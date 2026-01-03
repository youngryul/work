/**
 * Habit Tracker 생성 폼 컴포넌트
 * 키워드를 입력받아 Habit Tracker를 생성
 */
import { useState } from 'react'
import { createHabitTracker } from '../../services/goalService.js'

/**
 * 기본 색상 팔레트
 */
const COLOR_PALETTE = [
  '#FFB6C1', // 연한 핑크
  '#DDA0DD', // 연한 보라
  '#FFA07A', // 연한 살몬
  '#87CEEB', // 연한 하늘색
  '#F0E68C', // 연한 노랑
  '#98FB98', // 연한 초록
  '#FFB347', // 연한 복숭아
]

/**
 * @param {string} monthlyGoalId - 월별 목표 ID (기본값)
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {Array} monthlyGoals - 월별 목표 목록 (선택용)
 * @param {Function} onSave - 저장 완료 핸들러
 * @param {Function} onCancel - 취소 핸들러
 */
export default function HabitTrackerForm({ monthlyGoalId, year, month, monthlyGoals = [], onSave, onCancel }) {
  const [title, setTitle] = useState('')
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0])
  const [selectedMonthlyGoalId, setSelectedMonthlyGoalId] = useState(monthlyGoalId || '')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!title.trim()) {
      alert('습관 제목을 입력해주세요.')
      return
    }

    try {
      setLoading(true)
      await createHabitTracker({
        monthlyGoalId: selectedMonthlyGoalId || monthlyGoalId || null,
        year,
        month,
        title: title.trim(),
        color: selectedColor,
      })
      onSave?.()
    } catch (error) {
      console.error('Habit Tracker 생성 실패:', error)
      alert(error.message || 'Habit Tracker 생성에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 font-sans">
          Habit Tracker 추가
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 월별 목표 선택 (있는 경우) */}
          {monthlyGoals.length > 0 && (
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                월별 목표 선택 (선택 사항)
              </label>
              <select
                value={selectedMonthlyGoalId}
                onChange={(e) => setSelectedMonthlyGoalId(e.target.value)}
                className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
              >
                <option value="">월별 목표를 선택하지 않음</option>
                {monthlyGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 제목 입력 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              습관 제목 *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 운동 매일 가기"
              required
              className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
              autoFocus
            />
          </div>

          {/* 색상 선택 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              색상 선택
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`
                    w-10 h-10 rounded-full border-2 transition-all
                    ${selectedColor === color 
                      ? 'border-gray-800 scale-110 shadow-md' 
                      : 'border-gray-300 hover:scale-105'
                    }
                  `}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
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
              {loading ? '생성 중...' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

