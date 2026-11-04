import { useEffect, useState } from 'react'
import { getCompletedTasksByMonth } from '../../services/taskService.js'
import { TIME_SLOTS, isValidTimeSlot, getTimeSlotForDate } from '../../constants/timeSlots.js'

/**
 * 완료한 할 일 목록 → 시간대별 "계획 vs 실제 완료 시간대" 집계
 * @param {Array} tasks - completedAt이 있는 완료 할 일
 */
function buildTimeSlotStats(tasks) {
  const stats = Object.fromEntries(
    TIME_SLOTS.map((slot) => [slot.key, { planned: 0, onTime: 0, early: 0, late: 0 }]),
  )
  const slotOrder = TIME_SLOTS.map((slot) => slot.key)

  tasks.forEach((task) => {
    if (!isValidTimeSlot(task.timeSlot) || !task.completedAt) return
    const row = stats[task.timeSlot]
    row.planned += 1
    const actualIndex = slotOrder.indexOf(getTimeSlotForDate(task.completedAt))
    const plannedIndex = slotOrder.indexOf(task.timeSlot)
    if (actualIndex === plannedIndex) row.onTime += 1
    else if (actualIndex < plannedIndex) row.early += 1
    else row.late += 1
  })
  return stats
}

/**
 * 시간대 통계 카드: 계획한 시간대에 실제로 끝낸 비율
 * @param {{ year: number, month: number }} props - month: 1~12
 */
export default function TimeSlotStatsCard({ year, month }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    getCompletedTasksByMonth(year, month)
      .then((byDate) => {
        if (cancelled) return
        setStats(buildTimeSlotStats(Object.values(byDate || {}).flat()))
      })
      .catch((error) => console.error('시간대 통계 로드 오류:', error))
    return () => {
      cancelled = true
    }
  }, [year, month])

  if (!stats) return null

  const totalPlanned = TIME_SLOTS.reduce((sum, slot) => sum + stats[slot.key].planned, 0)
  if (totalPlanned === 0) {
    return (
      <div className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
        🕒 시간대를 지정하고 끝낸 할 일이 아직 없어요. 오늘 할 일에서 시간대를 정해 보세요!
      </div>
    )
  }

  // 제때 완료율이 가장 높은 시간대 (계획 3개 이상만)
  const rates = TIME_SLOTS.map((slot) => {
    const row = stats[slot.key]
    return { slot, row, rate: row.planned > 0 ? row.onTime / row.planned : 0 }
  })
  const best = rates
    .filter(({ row }) => row.planned >= 3)
    .sort((a, b) => b.rate - a.rate)[0]

  return (
    <div className="mt-6 rounded-lg bg-gray-50 p-4">
      <h3 className="text-lg font-semibold text-gray-800">🕒 시간대별 계획 vs 실제</h3>
      <p className="text-sm text-gray-500 mt-0.5">
        계획한 시간대 안에 끝낸 비율이에요. 낮은 시간대는 할 일을 줄이거나 옮겨 보세요.
      </p>

      <ul className="mt-3 space-y-3">
        {rates.map(({ slot, row, rate }) => (
          <li key={slot.key}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-gray-700">
                {slot.emoji} {slot.label}
              </span>
              <span className="text-gray-600 tabular-nums">
                {row.planned > 0 ? `${Math.round(rate * 100)}% · 계획 ${row.planned}개` : '계획 없음'}
              </span>
            </div>
            <div
              className="mt-1 h-2 rounded-full bg-gray-200 overflow-hidden"
              role="img"
              aria-label={`${slot.label} 제때 완료 ${Math.round(rate * 100)}%`}
            >
              <div className="h-full rounded-full bg-green-500" style={{ width: `${rate * 100}%` }} />
            </div>
            {row.planned > 0 && (row.early > 0 || row.late > 0) && (
              <p className="mt-0.5 text-xs text-gray-500">
                {row.early > 0 && `더 일찍 ${row.early}개`}
                {row.early > 0 && row.late > 0 && ' · '}
                {row.late > 0 && `더 늦게 ${row.late}개`}
              </p>
            )}
          </li>
        ))}
      </ul>

      {best && (
        <p className="mt-3 text-sm text-green-700">
          ✨ 이번 달엔 <b>{best.slot.label}</b>에 계획한 일을 가장 잘 지켰어요. 중요한 일은 이 시간대에 두면 좋아요.
        </p>
      )}
    </div>
  )
}
