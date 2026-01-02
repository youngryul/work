import { useState, useEffect } from 'react'
import WorldMap from './WorldMap.jsx'
import CountrySearch from './CountrySearch.jsx'
import { getAllVisitedCountries } from '../../services/visitedCountriesService.js'
import { getCountryName } from '../../constants/countries.js'

/**
 * 여행 메인 화면 컴포넌트
 * - 세계 지도 표시
 * - 국가 검색 기능
 * - 방문 국가 목록 표시
 */
export default function TravelView() {
  const [visitedCountries, setVisitedCountries] = useState([])
  const [loading, setLoading] = useState(true)

  // 방문 국가 목록 로드
  useEffect(() => {
    loadVisitedCountries()
  }, [])

  const loadVisitedCountries = async () => {
    setLoading(true)
    try {
      const countries = await getAllVisitedCountries()
      setVisitedCountries(countries)
    } catch (error) {
      console.error('방문 국가 목록 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 국가 추가 완료 핸들러
  const handleCountryAdded = async (countryCode) => {
    await loadVisitedCountries()
  }

  // 지도에서 국가 클릭 핸들러
  const handleCountryClick = async (countryCode, isVisited) => {
    await loadVisitedCountries()
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">세계 지도</h1>
        <p className="text-gray-600">방문한 국가를 클릭하거나 검색하여 추가하세요.</p>
      </div>

      {/* 국가 검색 */}
      <div className="mb-6">
        <CountrySearch onCountryAdded={handleCountryAdded} />
      </div>

      {/* 세계 지도 */}
      <div className="bg-white rounded-lg shadow-lg p-4 mb-6" style={{ minHeight: '600px' }}>
        <WorldMap onCountryClick={handleCountryClick} />
      </div>

      {/* 방문 국가 목록 */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          방문한 국가 ({visitedCountries.length}개)
        </h2>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
              <p className="text-gray-600">로딩 중...</p>
            </div>
          </div>
        ) : visitedCountries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            아직 방문한 국가가 없습니다. 지도를 클릭하거나 검색하여 국가를 추가해보세요.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {visitedCountries.map((country) => (
              <div
                key={country.id}
                className="bg-green-50 border border-green-200 rounded-lg p-3 text-center"
              >
                <div className="text-sm font-semibold text-green-800">
                  {getCountryName(country.countryCode)}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  {country.countryCode}
                </div>
                {country.visitedAt && (
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(country.visitedAt).toLocaleDateString('ko-KR')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
