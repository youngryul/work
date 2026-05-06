import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { getTravelById } from '../../services/travelService.js'
import { COMPANION_TYPE_ICON, COMPANION_TYPE_LABEL, PLACE_CATEGORY_ICON, PLACE_CATEGORY_LABEL } from '../../constants/travelConstants.js'
import PlaceForm from './PlaceForm.jsx'
import DateRecordForm from './DateRecordForm.jsx'
import TravelMap from './TravelMap.jsx'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 여행 상세 보기 컴포넌트
 */
export default function TravelDetail({ travelId, onClose, onEdit, onDelete, onUpdate }) {
  const [travel, setTravel] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'places' | 'records' | 'map'
  const [showPlaceForm, setShowPlaceForm] = useState(false)
  const [showDateRecordForm, setShowDateRecordForm] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    loadTravel()
  }, [travelId])

  const loadTravel = async () => {
    setIsLoading(true)
    try {
      const data = await getTravelById(travelId)
      setTravel(data)
    } catch (error) {
      console.error('여행 상세 로드 오류:', error)
      showToast('여행 정보를 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return format(new Date(dateString), 'yyyy년 M월 d일 (EEE)', { locale: ko })
  }

  const getDuration = () => {
    if (!travel?.startDate || !travel?.endDate) return ''
    const start = new Date(travel.startDate)
    const end = new Date(travel.endDate)
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    return `${days}박 ${days + 1}일`
  }

  const handlePlaceSave = () => {
    setShowPlaceForm(false)
    setSelectedPlace(null)
    loadTravel()
    if (onUpdate) onUpdate()
  }

  const handleDateRecordSave = () => {
    setShowDateRecordForm(false)
    setSelectedDate(null)
    loadTravel()
    if (onUpdate) onUpdate()
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-500 text-xl">로딩 중...</div>
      </div>
    )
  }

  if (!travel) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-500 text-xl">여행 정보를 찾을 수 없습니다.</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg">
      {/* 헤더 */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-3xl font-bold text-gray-800">{travel.title}</h2>
              {travel.isFavorite && <span className="text-yellow-500 text-2xl">⭐</span>}
              {travel.isPublic && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm">
                  공개
                </span>
              )}
            </div>
            <div className="text-gray-600">
              {formatDate(travel.startDate)} ~ {formatDate(travel.endDate)}
              <span className="ml-2">({getDuration()})</span>
            </div>
            <div className="text-gray-600 mt-1">
              📍 {travel.province} {travel.city}
            </div>
            <div className="text-gray-600 mt-1">
              {COMPANION_TYPE_ICON[travel.companionType]} {COMPANION_TYPE_LABEL[travel.companionType]}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* 만족도 */}
        {travel.satisfactionScore && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-gray-600">만족도:</span>
            {[1, 2, 3, 4, 5].map(score => (
              <span
                key={score}
                className={`text-xl ${score <= travel.satisfactionScore ? 'text-yellow-400' : 'text-gray-300'}`}
              >
                ★
              </span>
            ))}
            <span className="text-gray-600">({travel.satisfactionScore}/5)</span>
          </div>
        )}

        {/* 한줄 회고 */}
        {travel.oneLineReview && (
          <div className="text-gray-700 italic bg-gray-50 p-3 rounded-lg">
            "{travel.oneLineReview}"
          </div>
        )}

        {/* 태그 */}
        {travel.tags && travel.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {travel.tags.map(tag => (
              <span
                key={tag}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 감정 태그 */}
        {travel.emotions && travel.emotions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {travel.emotions.map(emotion => (
              <span
                key={emotion}
                className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
              >
                {emotion}
              </span>
            ))}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => onEdit(travel)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            수정
          </button>
          <button
            onClick={() => {
              if (confirm('정말 삭제하시겠습니까?')) {
                onDelete(travel.id)
                onClose()
              }
            }}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="flex items-center gap-1 border-b border-gray-200 px-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 transition-colors border-b-2 ${
            activeTab === 'overview'
              ? 'border-blue-500 text-blue-600 font-semibold'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          개요
        </button>
        <button
          onClick={() => setActiveTab('places')}
          className={`px-4 py-3 transition-colors border-b-2 ${
            activeTab === 'places'
              ? 'border-blue-500 text-blue-600 font-semibold'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          장소 ({travel.places?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-3 transition-colors border-b-2 ${
            activeTab === 'records'
              ? 'border-blue-500 text-blue-600 font-semibold'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          기록 ({travel.dateRecords?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-4 py-3 transition-colors border-b-2 ${
            activeTab === 'map'
              ? 'border-blue-500 text-blue-600 font-semibold'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          지도
        </button>
      </div>

      {/* 컨텐츠 */}
      <div className="p-6 max-h-[60vh] overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* 사진 갤러리 */}
            {travel.images && travel.images.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">사진</h3>
                <div className="grid grid-cols-3 gap-2">
                  {travel.images.slice(0, 9).map(image => (
                    <div key={image.id} className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                      <img
                        src={image.imageUrl}
                        alt={image.caption || '사진'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
                {travel.images.length > 9 && (
                  <div className="text-center text-gray-500 mt-2">
                    +{travel.images.length - 9}장 더
                  </div>
                )}
              </div>
            )}

            {/* 날짜별 기록 요약 */}
            {travel.dateRecords && travel.dateRecords.length > 0 && (
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">날짜별 기록 요약</h3>
                <div className="space-y-2">
                  {travel.dateRecords.slice(0, 5).map(record => (
                    <div key={record.id} className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm font-medium text-gray-600 mb-1">
                        {formatDate(record.recordDate)}
                      </div>
                      <div className="text-gray-700 line-clamp-2">
                        {record.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'places' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">방문 장소</h3>
              <button
                onClick={() => {
                  setSelectedPlace(null)
                  setShowPlaceForm(true)
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                + 장소 추가
              </button>
            </div>
            {travel.places && travel.places.length > 0 ? (
              <div className="space-y-3">
                {travel.places.map(place => (
                  <div key={place.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{PLACE_CATEGORY_ICON[place.category]}</span>
                          <h4 className="text-lg font-bold text-gray-800">{place.name}</h4>
                          <span className="text-sm text-gray-600">
                            {PLACE_CATEGORY_LABEL[place.category]}
                          </span>
                        </div>
                        {place.address && (
                          <div className="text-sm text-gray-600 mb-1">📍 {place.address}</div>
                        )}
                        {place.rating && (
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-sm text-gray-600">평점:</span>
                            {[1, 2, 3, 4, 5].map(score => (
                              <span
                                key={score}
                                className={`text-sm ${score <= place.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                              >
                                ★
                              </span>
                            ))}
                            <span className="text-sm text-gray-600">({place.rating}/5)</span>
                          </div>
                        )}
                        {place.memo && (
                          <div className="text-sm text-gray-700 mt-2">{place.memo}</div>
                        )}
                        {place.visitDate && (
                          <div className="text-xs text-gray-500 mt-1">
                            방문일: {formatDate(place.visitDate)}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedPlace(place)
                          setShowPlaceForm(true)
                        }}
                        className="ml-4 px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        수정
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                방문한 장소가 없습니다.
              </div>
            )}
          </div>
        )}

        {activeTab === 'records' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">날짜별 기록</h3>
              <button
                onClick={() => {
                  setSelectedDate(null)
                  setShowDateRecordForm(true)
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                + 기록 추가
              </button>
            </div>
            {travel.dateRecords && travel.dateRecords.length > 0 ? (
              <div className="space-y-3">
                {travel.dateRecords.map(record => (
                  <div key={record.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-600 mb-2">
                          {formatDate(record.recordDate)}
                        </div>
                        <div className="text-gray-700 whitespace-pre-wrap">
                          {record.content}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedDate(record.recordDate)
                          setShowDateRecordForm(true)
                        }}
                        className="ml-4 px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        수정
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                날짜별 기록이 없습니다.
              </div>
            )}
          </div>
        )}

        {activeTab === 'map' && (
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">여행 동선</h3>
            {travel.places && travel.places.length > 0 ? (
              <TravelMap places={travel.places} />
            ) : (
              <div className="text-center py-8 text-gray-400">
                지도에 표시할 장소가 없습니다.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 장소 폼 모달 */}
      {showPlaceForm && (
        <div className="fixed inset-0 z-[70] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <PlaceForm
              travelId={travelId}
              initialData={selectedPlace}
              onSave={handlePlaceSave}
              onCancel={() => {
                setShowPlaceForm(false)
                setSelectedPlace(null)
              }}
            />
          </div>
        </div>
      )}

      {/* 날짜별 기록 폼 모달 */}
      {showDateRecordForm && (
        <div className="fixed inset-0 z-[70] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <DateRecordForm
              travelId={travelId}
              initialDate={selectedDate}
              onSave={handleDateRecordSave}
              onCancel={() => {
                setShowDateRecordForm(false)
                setSelectedDate(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
