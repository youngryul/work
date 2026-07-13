import { useEffect, useState } from 'react'
import { minuteToTimeLabel } from '../../services/travelItineraryService.js'

/**
 * 등록된 일정만 세로 타임라인으로 표시. 클릭 시 상세(메모) 펼침.
 * @param {{
 *   items: Array,
 *   onEdit: (item: object) => void,
 * }} props
 */
export default function TravelItineraryTimeline({ items, onEdit }) {
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    setExpandedId(null)
  }, [items])

  if (!items.length) {
    return null
  }

  const sorted = [...items].sort((a, b) => a.startMinute - b.startMinute)

  return (
    <div className="rounded-2xl border border-amber-100 bg-[#fffdf6] p-5 shadow-sm">
      <p className="text-xs font-semibold tracking-widest text-amber-800/70 mb-4">SCHEDULE</p>

      <ol className="relative space-y-0">
        {sorted.map((item, index) => {
          const isExpanded = expandedId === item.id
          const isLast = index === sorted.length - 1
          const startLabel = minuteToTimeLabel(item.startMinute)
          const endLabel = minuteToTimeLabel(item.endMinute)

          return (
            <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
              {/* 세로 연결선 */}
              {!isLast && (
                <span
                  className="absolute left-[19px] top-10 bottom-0 w-px bg-gray-200"
                  aria-hidden
                />
              )}

              {/* 시간 뱃지 */}
              <div className="relative z-10 shrink-0 pt-0.5">
                <span className="inline-flex min-w-[52px] justify-center rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold font-mono text-gray-800 shadow-sm">
                  {startLabel}
                </span>
              </div>

              {/* 제목 + 상세 */}
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full text-left group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-semibold text-gray-900 group-hover:text-sky-700 transition-colors">
                      {item.title}
                    </p>
                    <span className="shrink-0 text-gray-400 text-sm mt-0.5">
                      {isExpanded ? '▴' : '▾'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">
                    {startLabel} – {endLabel}
                  </p>
                </button>

                {isExpanded && (
                  <div className="mt-3 rounded-xl border border-amber-100 bg-white p-4 shadow-sm animate-[fadeIn_0.15s_ease-out]">
                    <p className="text-xs font-semibold text-amber-800/80 mb-2">MEMO</p>
                    {item.memo?.trim() ? (
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {item.memo}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">등록된 상세 메모가 없습니다.</p>
                    )}
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="mt-3 text-sm font-semibold text-sky-600 hover:text-sky-800"
                    >
                      수정하기
                    </button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
