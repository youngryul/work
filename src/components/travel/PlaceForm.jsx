import { useState, useEffect, useRef } from 'react'
import { createPlace, updatePlace } from '../../services/travelService.js'
import { PLACE_CATEGORY, PLACE_CATEGORY_LABEL } from '../../constants/travelConstants.js'
import { geocodeAddress, searchPlaces } from '../../services/geocodingService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 장소 등록/수정 폼 컴포넌트
 */
export default function PlaceForm({ travelId, initialData, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    category: PLACE_CATEGORY.OTHER,
    address: '',
    latitude: '',
    longitude: '',
    rating: null,
    memo: '',
    visitDate: '',
    visitTime: '',
  })
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef(null)
  const addressInputRef = useRef(null)
  const searchResultsRef = useRef(null)

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        category: initialData.category || PLACE_CATEGORY.OTHER,
        address: initialData.address || '',
        latitude: initialData.latitude?.toString() || '',
        longitude: initialData.longitude?.toString() || '',
        rating: initialData.rating || null,
        memo: initialData.memo || '',
        visitDate: initialData.visitDate || '',
        visitTime: initialData.visitTime ? initialData.visitTime.split('T')[0] + 'T' + initialData.visitTime.split('T')[1].slice(0, 5) : '',
      })
    }
  }, [initialData])

  // 외부 클릭 시 검색 결과 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target) &&
        addressInputRef.current &&
        !addressInputRef.current.contains(event.target)
      ) {
        setShowSearchResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // 주소 입력 시 자동 검색
  const handleAddressChange = (e) => {
    const value = e.target.value
    setFormData({ ...formData, address: value })
    setShowSearchResults(true)

    // 기존 타이머 취소
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // 2글자 이상일 때만 검색
    if (value.trim().length < 2) {
      setSearchResults([])
      return
    }

    // 디바운싱 (300ms 후 검색)
    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(value)
        setSearchResults(results)
      } catch (error) {
        console.error('장소 검색 오류:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }

  // 검색 결과 선택
  const handleSelectSearchResult = (result) => {
    setFormData({
      ...formData,
      address: result.address,
      latitude: result.latitude.toString(),
      longitude: result.longitude.toString(),
      // 장소명이 비어있으면 검색 결과의 장소명 사용
      name: formData.name || result.placeName,
    })
    setShowSearchResults(false)
    setSearchResults([])
  }

  // 주소에서 좌표 자동 변환
  const handleAddressBlur = async () => {
    // 이미 좌표가 있으면 변환하지 않음
    if (formData.latitude && formData.longitude) {
      return
    }

    // 주소가 없으면 변환하지 않음
    if (!formData.address || !formData.address.trim()) {
      return
    }

    setIsGeocoding(true)
    try {
      const coords = await geocodeAddress(formData.address)
      if (coords) {
        setFormData(prev => ({
          ...prev,
          latitude: coords.latitude.toString(),
          longitude: coords.longitude.toString(),
        }))
        showToast('주소에서 좌표를 자동으로 가져왔습니다.', TOAST_TYPES.SUCCESS)
      } else {
        showToast('주소를 찾을 수 없습니다. 좌표를 수동으로 입력해주세요.', TOAST_TYPES.ERROR)
      }
    } catch (error) {
      console.error('주소 변환 오류:', error)
      showToast(error.message || '주소 변환에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsGeocoding(false)
    }
  }

  // 주소에서 좌표 가져오기 버튼
  const handleGeocodeClick = async () => {
    if (!formData.address || !formData.address.trim()) {
      showToast('주소를 먼저 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    setIsGeocoding(true)
    try {
      const coords = await geocodeAddress(formData.address)
      if (coords) {
        setFormData(prev => ({
          ...prev,
          latitude: coords.latitude.toString(),
          longitude: coords.longitude.toString(),
        }))
        showToast('주소에서 좌표를 가져왔습니다.', TOAST_TYPES.SUCCESS)
      } else {
        showToast('주소를 찾을 수 없습니다.', TOAST_TYPES.ERROR)
      }
    } catch (error) {
      console.error('주소 변환 오류:', error)
      showToast(error.message || '주소 변환에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsGeocoding(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      showToast('장소명을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      const placeData = {
        travelId,
        name: formData.name.trim(),
        category: formData.category,
        address: formData.address || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        rating: formData.rating || null,
        memo: formData.memo || null,
        visitDate: formData.visitDate || null,
        visitTime: formData.visitTime || null,
      }

      if (initialData?.id) {
        await updatePlace(initialData.id, placeData)
        showToast('장소가 수정되었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await createPlace(placeData)
        showToast('장소가 추가되었습니다.', TOAST_TYPES.SUCCESS)
      }
      onSave()
    } catch (error) {
      console.error('장소 저장 오류:', error)
      showToast(error.message || '저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">
        {initialData ? '장소 수정' : '새 장소 추가'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 장소명 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            장소명 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder="예: 한라산"
            required
          />
        </div>

        {/* 카테고리 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            카테고리
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
          >
            {Object.entries(PLACE_CATEGORY_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* 주소 */}
        <div className="relative">
          <label className="block text-base font-medium text-gray-700 mb-2">
            주소
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={addressInputRef}
                type="text"
                value={formData.address}
                onChange={handleAddressChange}
                onFocus={() => {
                  if (searchResults.length > 0) {
                    setShowSearchResults(true)
                  }
                }}
                onBlur={() => {
                  // 검색 결과 클릭을 기다리기 위해 약간의 지연
                  setTimeout(() => {
                    setShowSearchResults(false)
                    handleAddressBlur()
                  }, 200)
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                placeholder="주소 또는 장소명을 입력하세요"
              />
              
              {/* 자동완성 검색 결과 */}
              {showSearchResults && (searchResults.length > 0 || isSearching) && (
                <div
                  ref={searchResultsRef}
                  className="absolute z-50 w-full mt-1 bg-white border-2 border-blue-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                  {isSearching ? (
                    <div className="px-4 py-3 text-center text-gray-500">
                      검색 중...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-center text-gray-500">
                      검색 결과가 없습니다.
                    </div>
                  ) : (
                    searchResults.map((result, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSelectSearchResult(result)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-800 mb-1">
                          {result.placeName}
                        </div>
                        <div className="text-sm text-gray-600">
                          {result.address}
                        </div>
                        {result.category && (
                          <div className="text-xs text-gray-500 mt-1">
                            {result.category.split('>').pop()}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleGeocodeClick}
              disabled={isGeocoding || !formData.address?.trim()}
              className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-base whitespace-nowrap"
              title="주소에서 좌표 자동 가져오기"
            >
              {isGeocoding ? '변환 중...' : '📍 좌표 가져오기'}
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            주소 또는 장소명을 입력하면 자동으로 검색됩니다. 검색 결과를 선택하면 주소와 좌표가 자동으로 입력됩니다.
          </p>
        </div>

        {/* 위치 정보 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              위도
            </label>
            <input
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              placeholder="예: 33.4996"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              경도
            </label>
            <input
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              placeholder="예: 126.5312"
            />
          </div>
        </div>

        {/* 평점 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            평점 (1-5점)
          </label>
          <div className="flex items-center gap-4">
            {[1, 2, 3, 4, 5].map(score => (
              <button
                key={score}
                type="button"
                onClick={() => setFormData({ ...formData, rating: formData.rating === score ? null : score })}
                className={`w-12 h-12 rounded-full text-xl font-bold transition-colors ${
                  formData.rating === score
                    ? 'bg-yellow-400 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {score}
              </button>
            ))}
            {formData.rating && (
              <span className="text-gray-600">
                {formData.rating}점 선택됨
              </span>
            )}
          </div>
        </div>

        {/* 방문 날짜/시간 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              방문 날짜
            </label>
            <input
              type="date"
              value={formData.visitDate}
              onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              방문 시간
            </label>
            <input
              type="time"
              value={formData.visitTime}
              onChange={(e) => setFormData({ ...formData, visitTime: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            />
          </div>
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            메모
          </label>
          <textarea
            value={formData.memo}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder="이 장소에 대한 메모를 작성해보세요"
            rows={4}
          />
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 text-base font-medium"
          >
            취소
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-base font-medium"
          >
            {initialData ? '수정' : '추가'}
          </button>
        </div>
      </form>
    </div>
  )
}
