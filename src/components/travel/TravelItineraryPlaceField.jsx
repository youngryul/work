import { useEffect, useRef, useState } from 'react'
import { searchFreePlaces } from '../../services/freePlacesService.js'

/**
 * 여행 일정용 장소 입력 (무료 Photon 검색 + 직접 입력, API 키 불필요)
 * @param {{
 *   placeName: string,
 *   placeAddress: string,
 *   placeLat: number | null,
 *   placeLng: number | null,
 *   googlePlaceId: string,
 *   countryCode?: string,
 *   onChange: (next: {
 *     placeName: string,
 *     placeAddress: string,
 *     placeLat: number | null,
 *     placeLng: number | null,
 *     googlePlaceId: string,
 *   }) => void,
 * }} props
 */
export default function TravelItineraryPlaceField({
  placeName,
  placeAddress,
  placeLat,
  placeLng,
  googlePlaceId,
  countryCode,
  onChange,
}) {
  const [query, setQuery] = useState(placeName || '')
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const timeoutRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    setQuery(placeName || '')
  }, [placeName])

  useEffect(() => {
    const onDocClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const emit = (patch) => {
    onChange({
      placeName,
      placeAddress,
      placeLat,
      placeLng,
      googlePlaceId,
      ...patch,
    })
  }

  const clearPlace = () => {
    setQuery('')
    setResults([])
    setShowResults(false)
    emit({
      placeName: '',
      placeAddress: '',
      placeLat: null,
      placeLng: null,
      googlePlaceId: '',
    })
  }

  const handleQueryChange = (value) => {
    setQuery(value)
    emit({
      placeName: value,
      placeAddress: '',
      placeLat: null,
      placeLng: null,
      googlePlaceId: '',
    })

    setShowResults(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (value.trim().length < 2) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    // Nominatim/Photon 사용 정책에 맞춰 요청 간격 확보
    timeoutRef.current = setTimeout(async () => {
      const next = await searchFreePlaces(value, { countryCode })
      setResults(next)
      setIsSearching(false)
    }, 400)
  }

  const handleSelect = (suggestion) => {
    setShowResults(false)
    setResults([])
    setQuery(suggestion.placeName)
    emit({
      placeName: suggestion.placeName,
      placeAddress: suggestion.placeAddress,
      placeLat: suggestion.placeLat,
      placeLng: suggestion.placeLng,
      googlePlaceId: '',
    })
  }

  return (
    <div ref={wrapRef} className="relative space-y-2">
      <label className="block">
        <span className="text-sm font-medium text-gray-700 mb-1 block">장소</span>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="장소 검색 또는 직접 입력"
            className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={clearPlace}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 px-1"
              aria-label="장소 지우기"
            >
              ×
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-400">
          검색은 무료 지도 데이터를 사용합니다. 저장 후 구글 지도로 열 수 있습니다.
        </p>
      </label>

      {placeAddress && (
        <p className="text-xs text-gray-500 leading-relaxed">{placeAddress}</p>
      )}

      {showResults && (results.length > 0 || isSearching) && (
        <ul className="absolute z-20 left-0 right-0 top-[4.5rem] max-h-52 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {isSearching && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-400">검색 중...</li>
          )}
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full text-left px-3 py-2.5 hover:bg-sky-50 border-b border-gray-50 last:border-0"
              >
                <p className="text-sm font-medium text-gray-800">{item.placeName}</p>
                {item.placeAddress && item.placeAddress !== item.placeName && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.placeAddress}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
