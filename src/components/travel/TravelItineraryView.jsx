import { useEffect, useState } from 'react'
import { getCountryName } from '../../constants/countries.js'
import {
  deleteAbroadTrip,
  getAbroadTrips,
} from '../../services/travelItineraryService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import TravelItineraryCreateForm from './TravelItineraryCreateForm.jsx'
import TravelItineraryDetail from './TravelItineraryDetail.jsx'

function formatTripDateTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * 해외 여행 일정 메인 (목록 / 상세)
 */
export default function TravelItineraryView() {
  const [trips, setTrips] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTrip, setSelectedTrip] = useState(null)

  const loadTrips = async () => {
    setIsLoading(true)
    try {
      const data = await getAbroadTrips()
      setTrips(data)
    } catch (error) {
      showToast(error?.message || '여행 목록을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTrips()
  }, [])

  if (selectedTrip) {
    return (
      <TravelItineraryDetail
        trip={selectedTrip}
        onBack={() => {
          setSelectedTrip(null)
          loadTrips()
        }}
      />
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 font-sans">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">여행 일정</h1>
          <p className="text-sm text-gray-500 mt-1">해외 여행만 · 30분 단위로 일정을 계획하세요</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600"
        >
          + 새 여행
        </button>
      </div>

      {isLoading ? (
        <p className="text-center text-gray-500 py-16">불러오는 중...</p>
      ) : trips.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-gray-200 bg-gray-50">
          <p className="text-4xl mb-3">✈️</p>
          <p className="text-gray-600 mb-4">등록된 해외 여행이 없어요</p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600"
          >
            첫 여행 등록하기
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {trips.map((trip) => (
            <li key={trip.id}>
              <div className="w-full rounded-2xl border border-gray-200 bg-white p-4 hover:border-sky-300 hover:shadow-sm transition-all flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTrip(trip)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-sky-600 mb-1">
                        {getCountryName(trip.countryCode)}
                      </p>
                      <h2 className="text-lg font-bold text-gray-900">{trip.title}</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatTripDateTime(trip.departureAt)} ~ {formatTripDateTime(trip.returnAt)}
                      </p>
                    </div>
                    <span className="text-sky-500 text-sm shrink-0">열기 →</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`「${trip.title}」여행을 삭제할까요?`)) return
                    try {
                      await deleteAbroadTrip(trip.id)
                      showToast('여행을 삭제했습니다.', TOAST_TYPES.SUCCESS)
                      await loadTrips()
                    } catch (error) {
                      showToast(error?.message || '삭제에 실패했습니다.', TOAST_TYPES.ERROR)
                    }
                  }}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <TravelItineraryCreateForm
          onCancel={() => setShowCreate(false)}
          onCreated={(trip) => {
            setShowCreate(false)
            setSelectedTrip(trip)
            loadTrips()
          }}
        />
      )}
    </div>
  )
}
