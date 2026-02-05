import { useState, useEffect } from 'react'
import { getYearlyStatistics, getProvinceStatistics, getSatisfactionStatistics, getAllTravels } from '../../services/travelService.js'
import { PROVINCES } from '../../constants/travelConstants.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 여행 통계 컴포넌트
 */
export default function TravelStatistics() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [yearlyStats, setYearlyStats] = useState(null)
  const [provinceStats, setProvinceStats] = useState({})
  const [satisfactionStats, setSatisfactionStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadStatistics()
  }, [year])

  const loadStatistics = async () => {
    setIsLoading(true)
    try {
      const [yearly, province, satisfaction] = await Promise.all([
        getYearlyStatistics(year),
        getProvinceStatistics(),
        getSatisfactionStatistics(),
      ])
      setYearlyStats(yearly)
      setProvinceStats(province)
      setSatisfactionStats(satisfaction)
    } catch (error) {
      console.error('통계 로드 오류:', error)
      showToast('통계를 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  // 지역별 통계 정렬 (방문 횟수 순)
  const sortedProvinces = Object.entries(provinceStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10) // 상위 10개

  // 만족도 분포 데이터
  const satisfactionDistribution = satisfactionStats?.distribution || {}
  const maxSatisfactionCount = Math.max(...Object.values(satisfactionDistribution), 1)

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-500 text-2xl">로딩 중...</div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 연도 선택 */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center gap-4">
          <label className="text-xl text-gray-600">연도 선택:</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
          >
            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 연도별 통계 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <div className="text-4xl font-bold text-blue-600 mb-2">
            {yearlyStats?.totalTrips || 0}
          </div>
          <div className="text-xl text-gray-700">여행 횟수</div>
        </div>
        <div className="bg-green-50 rounded-lg p-6 border border-green-200">
          <div className="text-4xl font-bold text-green-600 mb-2">
            {yearlyStats?.totalDays || 0}
          </div>
          <div className="text-xl text-gray-700">총 여행 일수</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
          <div className="text-4xl font-bold text-yellow-600 mb-2">
            {yearlyStats?.averageSatisfaction?.toFixed(1) || '0.0'}
          </div>
          <div className="text-xl text-gray-700">평균 만족도</div>
        </div>
      </div>

      {/* 지역별 방문 통계 */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">지역별 방문 통계</h2>
        {sortedProvinces.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            방문 지역 데이터가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedProvinces.map(([province, count]) => {
              const maxCount = Math.max(...Object.values(provinceStats), 1)
              const percentage = (count / maxCount) * 100

              return (
                <div key={province} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 font-medium">{province}</span>
                    <span className="text-gray-600">{count}회</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-blue-500 h-4 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 만족도 통계 */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">만족도 통계</h2>
        {satisfactionStats && Object.keys(satisfactionDistribution).length > 0 ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-yellow-600 mb-2">
                {satisfactionStats.average?.toFixed(1) || '0.0'}
              </div>
              <div className="text-xl text-gray-600">평균 만족도</div>
            </div>
            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map(score => {
                const count = satisfactionDistribution[score] || 0
                const percentage = maxSatisfactionCount > 0 ? (count / maxSatisfactionCount) * 100 : 0

                return (
                  <div key={score} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700 font-medium">{score}점</span>
                        <div className="flex">
                          {[...Array(score)].map((_, i) => (
                            <span key={i} className="text-yellow-400">★</span>
                          ))}
                        </div>
                      </div>
                      <span className="text-gray-600">{count}회</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-yellow-400 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            만족도 데이터가 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}
