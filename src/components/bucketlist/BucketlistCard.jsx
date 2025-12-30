import { BUCKETLIST_STATUS, BUCKETLIST_CATEGORY_LABELS, BUCKETLIST_CATEGORY_COLORS } from '../../constants/bucketlistConstants.js'

/**
 * 버킷리스트 카드 컴포넌트
 */
export default function BucketlistCard({ bucketlist, onEdit, onDelete, onStatusChange }) {
  const formatDate = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
  }

  const isCompleted = bucketlist.status === BUCKETLIST_STATUS.COMPLETED

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200 hover:shadow-lg transition-shadow duration-200">
      {/* 한 줄 레이아웃 */}
      <div className="flex items-center gap-4">
        {/* 체크박스 */}
        <button
          onClick={() => {
            const newStatus = isCompleted ? BUCKETLIST_STATUS.NOT_COMPLETED : BUCKETLIST_STATUS.COMPLETED
            onStatusChange?.(bucketlist.id, newStatus)
          }}
          className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all duration-200 ${
            isCompleted
              ? 'bg-green-500 border-green-500'
              : 'bg-white border-gray-300 hover:border-green-400'
          }`}
        >
          {isCompleted && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* 제목 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className={`text-xl font-bold ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              {bucketlist.title}
            </h3>
            {bucketlist.completedAt && (
              <span className="text-gray-400 text-xs">
                {formatDate(bucketlist.completedAt)}
              </span>
            )}
          </div>
        </div>

        {/* 액션 버튼 (아이콘) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onEdit?.(bucketlist)}
            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors duration-200"
            title="수정"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (confirm('정말 삭제하시겠습니까?')) {
                onDelete?.(bucketlist.id)
              }
            }}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
            title="삭제"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
