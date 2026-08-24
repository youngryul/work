import { useEffect, useMemo, useState } from 'react'
import { getCountryName } from '../../constants/countries.js'
import { formatTravelPeriod, TRAVEL_ALBUM_MAX_PHOTOS } from '../../constants/travelConstants.js'
import {
  deleteTravelAlbum,
  getAbroadAlbumPhotosForUser,
  getAbroadTrips,
  getTravelAlbums,
  toDateKey,
} from '../../services/travelItineraryService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import TravelAlbumCreateModal from './TravelAlbumCreateModal.jsx'
import TravelItineraryAlbum from './TravelItineraryAlbum.jsx'

/**
 * 여행 앨범 독립 화면
 */
export default function TravelAlbumView() {
  const [albums, setAlbums] = useState([])
  const [trips, setTrips] = useState([])
  const [photosByAlbum, setPhotosByAlbum] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  const loadAlbums = async () => {
    setIsLoading(true)
    try {
      const [albumList, tripList, allPhotos] = await Promise.all([
        getTravelAlbums(),
        getAbroadTrips(),
        getAbroadAlbumPhotosForUser(),
      ])
      const grouped = {}
      allPhotos.forEach((photo) => {
        const key = photo.albumId || photo.tripId
        if (!key) return
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(photo)
      })
      setAlbums(
        albumList.map((album) => {
          if (album.startDate && album.endDate) return album
          const trip = tripList.find((item) => item.id === album.tripId)
          if (!trip) return album
          return {
            ...album,
            startDate: album.startDate || toDateKey(trip.departureAt) || null,
            endDate: album.endDate || toDateKey(trip.returnAt) || null,
          }
        }),
      )
      setTrips(tripList)
      setPhotosByAlbum(grouped)
    } catch (error) {
      showToast(error?.message || '앨범 목록을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAlbums()
  }, [])

  const linkedTripIds = useMemo(
    () => new Set(albums.map((album) => album.tripId).filter(Boolean)),
    [albums],
  )

  const selectedPhotos = useMemo(
    () => (selectedAlbum ? photosByAlbum[selectedAlbum.id] || [] : []),
    [photosByAlbum, selectedAlbum],
  )

  const handleDeleteAlbum = async (event, album) => {
    event.stopPropagation()
    if (!window.confirm(`「${album.title}」앨범을 삭제할까요? 사진도 함께 삭제됩니다.`)) return
    try {
      await deleteTravelAlbum(album.id)
      showToast('앨범을 삭제했습니다.', TOAST_TYPES.SUCCESS)
      await loadAlbums()
    } catch (error) {
      showToast(error?.message || '앨범을 삭제하지 못했습니다.', TOAST_TYPES.ERROR)
    }
  }

  if (selectedAlbum) {
    return (
      <div className="max-w-4xl mx-auto px-4 font-sans">
        <button
          type="button"
          onClick={() => {
            setSelectedAlbum(null)
            loadAlbums()
          }}
          className="text-sm text-rose-600 hover:text-rose-800 mb-4"
        >
          ← 앨범 목록
        </button>
        <TravelItineraryAlbum
          albumId={selectedAlbum.id}
          tripId={selectedAlbum.tripId}
          albumTitle={selectedAlbum.title}
          periodLabel={formatTravelPeriod(selectedAlbum.startDate, selectedAlbum.endDate)}
          initialPhotos={selectedPhotos}
        />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 font-sans">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">여행 앨범</h1>
          <p className="text-sm text-gray-500 mt-1">
            앨범마다 폴라로이드 최대 {TRAVEL_ALBUM_MAX_PHOTOS}장
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600"
        >
          + 앨범 추가
        </button>
      </div>

      {isLoading ? (
        <p className="text-center text-gray-500 py-16">앨범을 불러오는 중...</p>
      ) : albums.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-stone-200 bg-stone-50">
          <p className="text-4xl mb-3">📸</p>
          <p className="text-gray-600">아직 앨범이 없어요</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            여행 일정에서 가져오거나, 새 앨범을 만들어 보세요
          </p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600"
          >
            + 첫 앨범 추가
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {albums.map((album) => {
            const photos = photosByAlbum[album.id] || photosByAlbum[album.tripId] || []
            const cover = photos[0]
            const periodLabel = formatTravelPeriod(album.startDate, album.endDate)
            return (
              <li key={album.id}>
                <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden hover:border-rose-300 hover:shadow-sm transition-all">
                  <button
                    type="button"
                    onClick={() => setSelectedAlbum(album)}
                    className="w-full text-left"
                  >
                    <div className="aspect-[4/3] bg-stone-100 overflow-hidden relative">
                      {cover ? (
                        <img
                          src={cover.imageUrl}
                          alt={album.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400">
                          <span className="text-sm">아직 사진이 없어요</span>
                        </div>
                      )}
                      {periodLabel ? (
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8">
                          <p className="text-white text-sm font-semibold tracking-wide">
                            {periodLabel}
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-semibold text-rose-600 mb-1">
                        {album.countryCode ? getCountryName(album.countryCode) : '여행 앨범'}
                        {album.tripId ? ' · 일정 연동' : ''}
                      </p>
                      <h2 className="text-lg font-bold text-gray-900 truncate">{album.title}</h2>
                      {periodLabel ? (
                        <p className="text-sm text-stone-600 mt-1">{periodLabel}</p>
                      ) : null}
                      <p className="text-sm text-stone-500 mt-1">
                        {photos.length}/{TRAVEL_ALBUM_MAX_PHOTOS}장
                      </p>
                    </div>
                  </button>
                  <div className="px-4 pb-3 flex justify-end">
                    <button
                      type="button"
                      onClick={(event) => handleDeleteAlbum(event, album)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {showCreate && (
        <TravelAlbumCreateModal
          trips={trips}
          linkedTripIds={linkedTripIds}
          onCancel={() => setShowCreate(false)}
          onCreated={(album) => {
            setShowCreate(false)
            setSelectedAlbum(album)
            loadAlbums()
          }}
        />
      )}
    </div>
  )
}
