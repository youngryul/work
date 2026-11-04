import { useEffect, useState } from 'react'
import { formatStudyDuration, getPomodoroSummary } from '../services/studyTimeService.js'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 뽀모도로 합계 카드 (할 일 달력과 별도로 집계)
 * @param {{ refreshKey?: number }} props - 값이 바뀌면 다시 불러옴 (기록 저장 후)
 */
export default function PomodoroSummaryCard({ refreshKey = 0 }) {
  const [summary, setSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredDate, setHoveredDate] = useState(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    getPomodoroSummary()
      .then((result) => {
        if (!cancelled) setSummary(result)
      })
      .catch((error) => console.error('뽀모도로 합계 로드 오류:', error))
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (isLoading && !summary) {
    return <div className="text-center text-sm text-gray-400 py-4">합계 불러오는 중...</div>
  }
  if (!summary) return null

  const tiles = [
    { label: '오늘', data: summary.today },
    { label: '이번 주', data: summary.week },
    { label: '이번 달', data: summary.month },
    { label: '전체', data: summary.all },
  ]
  const maxDaySeconds = Math.max(...summary.recentDays.map((d) => d.seconds), 1)
  const hovered = summary.recentDays.find((d) => d.date === hoveredDate)

  return (
    <div className="w-full rounded-2xl bg-white/80 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700">🍅 뽀모도로 합계</h2>
      <p className="text-[11px] text-gray-400 mt-0.5">할 일 달력과 따로 모아서 보여줘요</p>

      {/* 기간별 합계 */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {tiles.map(({ label, data }) => (
          <div key={label} className="rounded-xl bg-[#f5ede0] px-3 py-2">
            <p className="text-[11px] text-gray-500">{label}</p>
            <p className="text-base font-semibold text-gray-800 tabular-nums">
              {data.seconds > 0 ? formatStudyDuration(data.seconds) : '-'}
            </p>
            <p className="text-[11px] text-gray-500 tabular-nums">{data.count}회</p>
          </div>
        ))}
      </div>

      {/* 최근 7일 막대 */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold text-gray-600">최근 7일</p>
          <p className="text-[11px] text-gray-500 tabular-nums h-4">
            {hovered
              ? `${hovered.date.slice(5).replace('-', '/')} · ${
                  hovered.seconds > 0 ? formatStudyDuration(hovered.seconds) : '기록 없음'
                }`
              : ''}
          </p>
        </div>
        <div className="mt-2 flex items-end gap-2 h-20 border-b border-gray-200">
          {summary.recentDays.map((day) => {
            const heightPct = day.seconds > 0 ? Math.max(6, (day.seconds / maxDaySeconds) * 100) : 0
            return (
              <div
                key={day.date}
                className="flex-1 h-full flex items-end cursor-default"
                onMouseEnter={() => setHoveredDate(day.date)}
                onMouseLeave={() => setHoveredDate(null)}
                title={`${day.date} ${day.seconds > 0 ? formatStudyDuration(day.seconds) : '기록 없음'}`}
              >
                <div
                  className={`w-full max-w-[18px] mx-auto rounded-t ${
                    hoveredDate === day.date ? 'bg-green-700' : 'bg-green-500'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex gap-2">
          {summary.recentDays.map((day) => {
            const [y, m, d] = day.date.split('-').map(Number)
            return (
              <span key={day.date} className="flex-1 text-center text-[10px] text-gray-400">
                {WEEKDAYS[new Date(y, m - 1, d).getDay()]}
              </span>
            )
          })}
        </div>
      </div>

      {/* 이번 달 할 일별 합계 */}
      {summary.topTasks.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-600">이번 달 집중한 할 일</p>
          <ul className="mt-1 space-y-1">
            {summary.topTasks.map((task) => (
              <li key={task.title} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-gray-700">{task.title}</span>
                <span className="shrink-0 text-gray-500 tabular-nums">
                  {formatStudyDuration(task.seconds)} · {task.count}회
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
