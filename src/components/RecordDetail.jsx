import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

/**
 * 기록 상세 컴포넌트
 * @param {Object} record - 기록 데이터
 * @param {Function} onEdit - 수정 핸들러
 * @param {Function} onDelete - 삭제 핸들러
 */
export default function RecordDetail({ record, onEdit, onDelete }) {
  if (!record) {
    return (
      <div className="text-center py-12 text-gray-500 text-base font-sans">
        <p>기록을 선택해주세요.</p>
      </div>
    )
  }

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString), 'yyyy년 MM월 dd일 (EEE)', { locale: ko })
    } catch {
      return dateString
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="border-b-2 border-pink-200 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base text-gray-600 font-sans">{record.projectName}</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-1 font-sans">{record.title}</h1>
              <p className="text-base text-gray-500 font-sans">{formatDate(record.date)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit?.(record)}
                className="px-4 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors text-base font-medium shadow-md font-sans"
              >
                수정
              </button>
              <button
                onClick={() => {
                  if (confirm('정말 삭제하시겠습니까?')) {
                    onDelete?.(record.id)
                  }
                }}
                className="px-4 py-2 bg-red-400 text-white rounded-lg hover:bg-red-500 transition-colors text-base font-medium shadow-md font-sans"
              >
                삭제
              </button>
            </div>
          </div>
        </div>

        {/* 본문 내용 */}
        {(record.content || record.background) && (
          <div className="text-gray-700 text-base font-sans whitespace-pre-wrap leading-relaxed">
            {record.content || record.background || ''}
          </div>
        )}
      </div>
    </div>
  )
}
