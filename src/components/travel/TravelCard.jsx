import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { COMPANION_TYPE_ICON, COMPANION_TYPE_LABEL } from '../../constants/travelConstants.js'

/**
 * 여행 카드 컴포넌트
 */
export default function TravelCard({ travel, onView, onEdit, onDelete }) {
  const formatDate = (dateString) => {
    if (!dateString) return ''
    return format(new Date(dateString), 'yyyy년 M월 d일', { locale: ko })
  }

  const getDuration = () => {
    if (!travel.startDate || !travel.endDate) return ''
    const start = new Date(travel.startDate)
    const end = new Date(travel.endDate)
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    return `${days}박 ${days + 1}일`
  }

  const handleCardClick = (e) => {
    // 버튼 클릭이 아닌 경우에만 상세 보기
    if (!e.target.closest('button')) {
      onView(travel)
    }
  }

  return (
    <div
      className="bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
      onClick={handleCardClick}
    >
      {/* 대표 이미지 */}
      {travel.representativeImageUrl ? (
        <div className="h-48 bg-gray-200 overflow-hidden">
          <img
            src={travel.representativeImageUrl}
            alt={travel.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }}
          />
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-emerald-500 flex items-center justify-center text-white text-4xl" style={{ display: 'none' }}>
            ✈️
          </div>
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-blue-400 to-emerald-500 flex items-center justify-center text-white text-4xl">
          ✈️
        </div>
      )}

      {/* 내용 */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-bold text-gray-800 flex-1 line-clamp-2">
            {travel.title}
          </h3>
          {travel.isFavorite && (
            <span className="text-yellow-500 text-2xl ml-2 flex-shrink-0">⭐</span>
          )}
        </div>

        {/* 기간 */}
        <div className="text-sm text-gray-600 mb-2">
          {formatDate(travel.startDate)} ~ {formatDate(travel.endDate)}
          <span className="ml-2 text-gray-500">({getDuration()})</span>
        </div>

        {/* 지역 */}
        <div className="text-sm text-gray-600 mb-2">
          📍 {travel.province}
          {travel.city && ` ${travel.city}`}
        </div>

        {/* 동행 유형 */}
        <div className="text-sm text-gray-600 mb-2">
          {COMPANION_TYPE_ICON[travel.companionType]} {COMPANION_TYPE_LABEL[travel.companionType]}
        </div>

        {/* 만족도 */}
        {travel.satisfactionScore && (
          <div className="flex items-center gap-1 mb-2">
            <span className="text-sm text-gray-600">만족도:</span>
            {[1, 2, 3, 4, 5].map(score => (
              <span
                key={score}
                className={`text-lg ${score <= travel.satisfactionScore ? 'text-yellow-400' : 'text-gray-300'}`}
              >
                ★
              </span>
            ))}
            <span className="text-sm text-gray-600 ml-1">({travel.satisfactionScore}/5)</span>
          </div>
        )}

        {/* 한줄 회고 */}
        {travel.oneLineReview && (
          <div className="text-sm text-gray-700 italic mb-3 line-clamp-2">
            "{travel.oneLineReview}"
          </div>
        )}

        {/* 태그 */}
        {travel.tags && travel.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {travel.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
              >
                {tag}
              </span>
            ))}
            {travel.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                +{travel.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(travel)
            }}
            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          >
            수정
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('정말 삭제하시겠습니까?')) {
                onDelete(travel.id)
              }
            }}
            className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
