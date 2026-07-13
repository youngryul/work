import { useEffect, useMemo, useRef, useState } from 'react'
import { getAbroadCountryOptions } from '../../constants/travelAbroad.js'
import { createAbroadTrip } from '../../services/travelItineraryService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * @param {{ onCancel: () => void, onCreated: (trip: object) => void }} props
 */
export default function TravelItineraryCreateForm({ onCancel, onCreated }) {
  const countries = useMemo(() => getAbroadCountryOptions(), [])
  const [title, setTitle] = useState('')
  const [countryCode, setCountryCode] = useState('JP')
  const [countryInput, setCountryInput] = useState(() => {
    const jp = countries.find((c) => c.code === 'JP')
    return jp ? `${jp.name} (${jp.code})` : ''
  })
  const [isCountryOpen, setIsCountryOpen] = useState(false)
  const [departureDate, setDepartureDate] = useState('')
  const [departureTime, setDepartureTime] = useState('09:00')
  const [returnDate, setReturnDate] = useState('')
  const [returnTime, setReturnTime] = useState('21:00')
  const [isSaving, setIsSaving] = useState(false)
  const countryBoxRef = useRef(null)

  const selectedCountry = countries.find((c) => c.code === countryCode)

  const filteredCountries = useMemo(() => {
    const selectedLabel = selectedCountry
      ? `${selectedCountry.name} (${selectedCountry.code})`
      : ''
    // 이미 선택된 값이 그대로 표시 중이면 전체 목록 노출
    if (!countryInput.trim() || countryInput === selectedLabel) {
      return countries
    }
    const q = countryInput.trim().toLowerCase()
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    )
  }, [countries, countryInput, selectedCountry])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!countryBoxRef.current?.contains(event.target)) {
        setIsCountryOpen(false)
        if (selectedCountry) {
          setCountryInput(`${selectedCountry.name} (${selectedCountry.code})`)
        }
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [selectedCountry])

  const selectCountry = (country) => {
    setCountryCode(country.code)
    setCountryInput(`${country.name} (${country.code})`)
    setIsCountryOpen(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!countryCode) {
      showToast('여행 국가를 선택해주세요.', TOAST_TYPES.ERROR)
      return
    }
    setIsSaving(true)
    try {
      const departureAt = new Date(`${departureDate}T${departureTime}:00`).toISOString()
      const returnAt = new Date(`${returnDate}T${returnTime}:00`).toISOString()
      const trip = await createAbroadTrip({
        title,
        countryCode,
        departureAt,
        returnAt,
      })
      showToast('여행이 등록되었습니다.', TOAST_TYPES.SUCCESS)
      onCreated(trip)
    } catch (error) {
      showToast(error?.message || '등록에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 bg-white">
          <h2 className="text-lg font-bold text-gray-800 font-sans">해외 여행 등록</h2>
          <button type="button" onClick={onCancel} className="text-2xl text-gray-400 hover:text-gray-600" aria-label="닫기">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 font-sans">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">여행 제목 *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 도쿄 3박 4일"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
              required
            />
          </label>

          <div ref={countryBoxRef} className="relative">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-1 block">여행 국가 *</span>
              <input
                type="text"
                value={countryInput}
                onChange={(e) => {
                  setCountryInput(e.target.value)
                  setIsCountryOpen(true)
                }}
                onFocus={() => setIsCountryOpen(true)}
                placeholder="국가 검색 또는 선택"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                autoComplete="off"
                required
              />
            </label>

            {isCountryOpen && (
              <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                {filteredCountries.length === 0 ? (
                  <li className="px-3 py-2.5 text-sm text-gray-400">검색 결과가 없습니다</li>
                ) : (
                  filteredCountries.map((c) => (
                    <li key={c.code}>
                      <button
                        type="button"
                        onClick={() => selectCountry(c)}
                        className={`w-full px-3 py-2.5 text-left text-sm hover:bg-sky-50 ${
                          c.code === countryCode ? 'bg-sky-50 font-semibold text-sky-800' : 'text-gray-800'
                        }`}
                      >
                        {c.name} ({c.code})
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-1 block">비행기 출발일 *</span>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-1 block">출발 시각</span>
              <input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                step={60}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-1 block">귀국 도착일 *</span>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-1 block">도착 시각</span>
              <input
                type="time"
                value={returnTime}
                onChange={(e) => setReturnTime(e.target.value)}
                step={60}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
                required
              />
            </label>
          </div>

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
              disabled={isSaving || !countryCode}
              className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600 disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
