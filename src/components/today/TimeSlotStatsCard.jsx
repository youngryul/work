import { useEffect, useState } from 'react'
import { getCompletedTasksByMonth } from '../../services/taskService.js'
import { TIME_SLOTS, getTimeSlotForDate } from '../../constants/timeSlots.js'

/**
 * 완료한 할 일 목록 → 실제 완료 시각(completedAt)이 속한 시간대별 완료 개수
 * 할 일에 지정된(계획) 시간대는 보지 않음 — 오후로 계획했어도 오전에 끝냈으면 오전으로 셈
 * @param {Array} tasks - 완료 할 일
 * @returns {Record<string, number>}
 */
function countByCompletedSlot(tasks) {
  const counts = Object.fromEntries(TIME_SLOTS.map((slot) => [slot.key, 0]))
  tasks.forEach((task) => {
    if (!task.completedAt) return
    counts[getTimeSlotForDate(task.completedAt)] += 1
  })
  return counts
}

/**
 * 시간대별 완료 카드: 이번 달에 각 시간대에 끝낸 할 일 개수
 * @param {{ year: number, month: number }} props - month: 1~12
 */
export default function TimeSlotStatsCard({ year, month }) {
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    let cancelled = false
    getCompletedTasksByMonth(year, month)
      .then((byDate) => {
        if (cancelled) return
        setCounts(countByCompletedSlot(Object.values(byDate || {}).flat()))
      })
      .catch((error) => console.error('시간대 통계 로드 오류:', error))
    return () => {
      cancelled = true
    }
  }, [year, month])

  if (!counts) return null

  const total = TIME_SLOTS.reduce((sum, slot) => sum + counts[slot.key], 0)
  if (total === 0) return null

  return (
    <div className="mt-6 rounded-lg bg-gray-50 p-4">
      <h3 className="text-lg font-semibold text-gray-800">🕒 시간대별 완료</h3>
      <p className="text-sm text-gray-500 mt-0.5">실제로 끝낸 시각을 기준으로 셌어요.</p>

      <ul className="mt-3 grid grid-cols-3 gap-2">
        {TIME_SLOTS.map((slot) => (
          <li key={slot.key} className="rounded-lg bg-white p-3 text-center">
            <div className="text-sm text-gray-600">
              {slot.emoji} {slot.label}
            </div>
            <div className="mt-1 text-xl font-bold text-green-600 tabular-nums">{counts[slot.key]}개</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
