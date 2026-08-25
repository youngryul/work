import { useMemo, useState } from 'react'
import {
  DEFAULT_TRAVEL_ALBUM_COUNTRY_CODE,
  getCountryName,
  getTravelAlbumCountryOptions,
} from '../../constants/countries.js'
import {
  createTravelAlbum,
  createTravelAlbumFromTrip,
} from '../../services/travelItineraryService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 앨범 추가: 일정에서 가져오기 / 새로 만들기
 * @param {{
 *   trips: Array,
 *   linkedTripIds: Set<string>,
 *   onCancel: () => void,
 *   onCreated: (album: object) => void,
 * }} props
 */
export default function TravelAlbumCreateModal({
  trips,
  linkedTripIds,
  onCancel,
  onCreated,
}) {
  const countries = useMemo(() => getTravelAlbumCountryOptions(), [])
  const availableTrips = trips.filter((trip) => !linkedTripIds.has(trip.id))
  const [mode, setMode] = useState(availableTrips.length > 0 ? 'trip' : 'new')
  const [selectedTripId, setSelectedTripId] = useState(availableTrips[0]?.id || '')
  const [title, setTitle] = useState('')
  const [countryCode, setCountryCode] = useState(DEFAULT_TRAVEL_ALBUM_COUNTRY_CODE)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      let album
      if (mode === 'trip') {
        const trip = availableTrips.find((item) => item.id === selectedTripId)
        if (!trip) throw new Error('가져올 여행 일정을 선택해주세요.')
        album = await createTravelAlbumFromTrip(trip)
        showToast('일정에서 앨범을 만들었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        album = await createTravelAlbum({ title, countryCode, startDate, endDate })
        showToast('새 앨범을 만들었습니다.', TOAST_TYPES.SUCCESS)
      }
      onCreated(album)
    } catch (error) {
      showToast(error?.message || '앨범을 만들지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 bg-white">
          <h2 className="text-lg font-bold text-gray-800 font-sans">앨범 추가</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-2xl text-gray-400 hover:text-gray-600"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="px-5 pt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('trip')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
              mode === 'trip'
                ? 'bg-rose-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            일정에서 가져오기
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
              mode === 'new'
                ? 'bg-rose-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            새로 만들기
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 font-sans">
          {mode === 'trip' ? (
            availableTrips.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                아직 앨범으로 가져올 여행 일정이 없어요.
                <br />
                새 앨범을 만들거나, 여행 일정에서 여행을 먼저 등록해 주세요.
              </p>
            ) : (
              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-1 block">여행 일정</span>
                <select
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white"
                >
                  {availableTrips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {getCountryName(trip.countryCode)} · {trip.title}
                      {trip.departureAt
                        ? ` (${String(trip.departureAt).slice(0, 10)} ~ ${String(trip.returnAt || '').slice(0, 10)})`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
            )
          ) : (
            <>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-1 block">앨범 제목 *</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 오사카 dump"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400"
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 mb-1 block">국가</span>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white"
                >
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name} ({country.code})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700 mb-1 block">여행 시작일 *</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700 mb-1 block">여행 종료일 *</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400"
                    required
                  />
                </label>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving || (mode === 'trip' && availableTrips.length === 0)}
              className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-semibold hover:bg-rose-600 disabled:opacity-50"
            >
              {isSaving ? '만드는 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
