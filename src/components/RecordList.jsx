import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

/**
 * 기록 목록 컴포넌트
 * @param {Array} records - 기록 목록
 * @param {string|null} selectedId - 선택된 기록 ID
 * @param {Function} onSelect - 기록 선택 핸들러
 */
export default function RecordList({ records = [], selectedId, onSelect }) {
  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'yyyy년 MM월 dd일', { locale: ko })
    } catch {
      return dateString
    }
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-base font-sans">
        <p>기록이 없습니다.</p>
        <p className="text-base mt-2">새로운 기록을 작성해보세요. ✨</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {records.map((record) => (
        <div
          key={record.id}
          onClick={() => onSelect(record.id)}
          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
            selectedId === record.id
              ? 'bg-green-100 border-green-400 shadow-md'
              : 'bg-white/60 border-green-200 hover:border-green-300 hover:shadow-sm hover:bg-white/80'
          }`}
        >
          {/* 날짜 */}
          <div className="mb-1">
            <span className="text-sm text-gray-600 font-sans">{formatDate(record.date)}</span>
          </div>

          {/* 제목 */}
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 line-clamp-2 font-sans flex-1">
              {record.title}
            </h3>
            {record.isMain && (
              <span className="text-xs px-2 py-1 bg-green-200 text-green-800 rounded-full font-medium font-sans">
                📌 메인
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
