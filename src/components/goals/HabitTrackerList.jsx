/**
 * Habit Tracker 리스트 컴포넌트
 * 월별 Habit Tracker를 독립적으로 관리
 */
import { useState, useEffect } from 'react'
import { getHabitTrackers, deleteHabitTracker } from '../../services/goalService.js'
import HabitTracker from './HabitTracker.jsx'
import HabitTrackerForm from './HabitTrackerForm.jsx'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {Array} monthlyGoals - 월별 목표 목록 (Habit Tracker 생성 시 선택용)
 */
export default function HabitTrackerList({ year, month, monthlyGoals = [] }) {
  const [habitTrackers, setHabitTrackers] = useState([])
  const [showTrackerForm, setShowTrackerForm] = useState(false)
  const [selectedMonthlyGoalId, setSelectedMonthlyGoalId] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadHabitTrackers()
  }, [year, month])

  const loadHabitTrackers = async () => {
    try {
      setLoading(true)
      const trackers = await getHabitTrackers(year, month)
      setHabitTrackers(trackers)
    } catch (error) {
      console.error('Habit Tracker 로드 실패:', error)
      showToast('Habit Tracker를 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTracker = async (trackerId) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      await deleteHabitTracker(trackerId)
      await loadHabitTrackers()
    } catch (error) {
      console.error('Habit Tracker 삭제 실패:', error)
      showToast('삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleAddTracker = () => {
    setShowTrackerForm(true)
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
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 font-sans">
          Habit Tracker
        </h2>
        <button
          onClick={handleAddTracker}
          className="px-4 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors text-sm font-medium shadow-md font-sans"
        >
          + Habit Tracker 추가
        </button>
      </div>

      {/* Habit Tracker 목록 */}
      {habitTrackers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-base text-gray-500 mb-2 font-sans">등록된 Habit Tracker가 없습니다.</p>
          <p className="text-sm text-gray-400 font-sans">습관을 추적해보세요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {habitTrackers.map((tracker) => (
            <div key={tracker.id} className="relative">
              <HabitTracker
                tracker={tracker}
                year={year}
                month={month}
                onUpdate={loadHabitTrackers}
              />
              <button
                onClick={() => handleDeleteTracker(tracker.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors text-xs font-bold shadow-md"
                title="삭제"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Habit Tracker 생성 폼 */}
      {showTrackerForm && (
        <HabitTrackerForm
          monthlyGoalId={selectedMonthlyGoalId || monthlyGoals[0]?.id}
          year={year}
          month={month}
          monthlyGoals={monthlyGoals}
          onSave={() => {
            setShowTrackerForm(false)
            setSelectedMonthlyGoalId(null)
            loadHabitTrackers()
          }}
          onCancel={() => {
            setShowTrackerForm(false)
            setSelectedMonthlyGoalId(null)
          }}
        />
      )}
    </div>
  )
}

