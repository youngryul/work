/**
 * 몸무게 기록 목록
 */
import { WEIGHT_UNIT } from '../../constants/weightTracking.js'

/**
 * @param {{ records: Array, onDelete: (id: string) => void, isDeleting?: string|null }} props
 */
export default function WeightRecordList({ records, onDelete, isDeleting = null }) {
  if (records.length === 0) {
    return (
      <p className="text-center text-gray-500 text-sm py-6">
        아직 기록이 없어요. 오늘 몸무게를 입력해보세요!
      </p>
    )
  }

  return (
    <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {records.map((record) => {
        const isToday = record.recordDate === new Date().toISOString().split('T')[0]
        return (
          <li
            key={record.id}
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border transition-colors ${
              isToday
                ? 'bg-orange-50 border-orange-200'
                : 'bg-white/80 border-orange-100 hover:bg-orange-50/50'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800">
                  {record.recordDate.replace(/-/g, '.')}
                </span>
                {isToday && (
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
                    오늘
                  </span>
                )}
              </div>
              {record.notes && (
                <p className="text-xs text-gray-500 truncate mt-0.5">{record.notes}</p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-lg font-bold text-orange-600 tabular-nums">
                {record.weightKg}
                <span className="text-sm font-medium text-orange-400 ml-0.5">{WEIGHT_UNIT}</span>
              </span>
              <button
                type="button"
                onClick={() => onDelete(record.id)}
                disabled={isDeleting === record.id}
                className="text-gray-400 hover:text-red-500 text-sm px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                aria-label="기록 삭제"
              >
                {isDeleting === record.id ? '…' : '삭제'}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
