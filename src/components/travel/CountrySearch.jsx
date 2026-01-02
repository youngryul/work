import { useState, useEffect, useRef } from 'react'
import { searchCountries, getCountryName } from '../../constants/countries.js'
import { addVisitedCountry, isCountryVisited } from '../../services/visitedCountriesService.js'

/**
 * 국가 검색 컴포넌트
 * - 국가명으로 검색하여 방문 국가 추가
 */
export default function CountrySearch({ onCountryAdded }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchInputRef = useRef(null)
  const resultsRef = useRef(null)

  // 검색어 변경 시 결과 업데이트
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([])
      setSelectedIndex(-1)
      return
    }

    const results = searchCountries(searchQuery)
    setSearchResults(results.slice(0, 10)) // 최대 10개만 표시
    setSelectedIndex(-1)
  }, [searchQuery])

  // 키보드 네비게이션
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => 
        prev < searchResults.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleCountrySelect(searchResults[selectedIndex].code)
    } else if (e.key === 'Escape') {
      setSearchQuery('')
      setSearchResults([])
      setSelectedIndex(-1)
      searchInputRef.current?.blur()
    }
  }

  // 국가 선택 핸들러
  const handleCountrySelect = async (countryCode) => {
    if (!countryCode) return

    setIsSearching(true)
    try {
      // 이미 방문한 국가인지 확인
      const alreadyVisited = await isCountryVisited(countryCode)
      if (alreadyVisited) {
        alert(`${getCountryName(countryCode)}은(는) 이미 방문한 국가입니다.`)
        setSearchQuery('')
        setSearchResults([])
        return
      }

      // 방문 국가 추가
      await addVisitedCountry(countryCode)
      
      if (onCountryAdded) {
        onCountryAdded(countryCode)
      }

      // 검색 초기화
      setSearchQuery('')
      setSearchResults([])
      setSelectedIndex(-1)
      searchInputRef.current?.blur()
    } catch (error) {
      console.error('방문 국가 추가 오류:', error)
      alert(`오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="국가명으로 검색..."
          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          disabled={isSearching}
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
          </div>
        )}
      </div>

      {/* 검색 결과 드롭다운 */}
      {searchResults.length > 0 && (
        <div
          ref={resultsRef}
          className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {searchResults.map((country, index) => (
            <button
              key={country.code}
              onClick={() => handleCountrySelect(country.code)}
              className={`w-full text-left px-4 py-2 hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none ${
                index === selectedIndex ? 'bg-indigo-100' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-900">{country.name}</span>
                <span className="text-xs text-gray-500">{country.code}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 검색어가 있지만 결과가 없을 때 */}
      {searchQuery.trim() !== '' && searchResults.length === 0 && !isSearching && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  )
}

