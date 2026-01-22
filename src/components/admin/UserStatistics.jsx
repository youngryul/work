import { useState, useEffect } from 'react'
import { getUserStatistics } from '../../services/adminStatisticsService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 사용자 통계 컴포넌트
 */
export default function UserStatistics() {
  const [statistics, setStatistics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStatistics()
  }, [])

  const loadStatistics = async () => {
    setLoading(true)
    try {
      const data = await getUserStatistics()
      setStatistics(data)
    } catch (error) {
      console.error('사용자 통계 로드 실패:', error)
      showToast('사용자 통계를 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-2xl text-gray-500 font-sans">로딩 중...</div>
      </div>
    )
  }

  if (!statistics) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
        <p className="text-base text-red-800 font-sans">통계 데이터를 불러올 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2 font-sans">총 사용자 수</h3>
          <p className="text-4xl font-bold text-blue-600 font-sans">{statistics.totalUsers}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2 font-sans">활성 사용자 수</h3>
          <p className="text-4xl font-bold text-green-600 font-sans">{statistics.activeUsers}</p>
          <p className="text-sm text-gray-500 mt-2 font-sans">(최근 30일 내 활동)</p>
        </div>
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2 font-sans">최근 활동 사용자</h3>
          <p className="text-4xl font-bold text-purple-600 font-sans">{statistics.recentSignUps}</p>
          <p className="text-sm text-gray-500 mt-2 font-sans">(최근 활동 기준)</p>
        </div>
      </div>

      {/* 활성 사용자 비율 */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 font-sans">활성 사용자 비율</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-200 rounded-full h-8">
            <div
              className="bg-green-500 h-8 rounded-full flex items-center justify-center text-white font-semibold font-sans"
              style={{
                width: `${
                  statistics.totalUsers > 0
                    ? (statistics.activeUsers / statistics.totalUsers) * 100
                    : 0
                }%`,
              }}
            >
              {statistics.totalUsers > 0
                ? Math.round((statistics.activeUsers / statistics.totalUsers) * 100)
                : 0}
              %
            </div>
          </div>
          <span className="text-sm text-gray-600 font-sans">
            {statistics.activeUsers} / {statistics.totalUsers}
          </span>
        </div>
      </div>

      {/* 최근 활동 사용자 */}
      {statistics.recentUsers && statistics.recentUsers.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 font-sans">
            최근 활동 사용자
            <span className="text-sm font-normal text-gray-500 ml-2">(최신 활동 순)</span>
          </h3>
          <div className="space-y-2">
            {statistics.recentUsers.map((user, index) => (
              <div
                key={user.userId || user}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200 font-sans"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">#{index + 1}</span>
                    <span className="text-gray-800 font-medium">
                      {typeof user === 'string' ? user : user.email}
                    </span>
                    {typeof user === 'object' && user.menu && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
                        {user.menu}
                      </span>
                    )}
                  </div>
                  {typeof user === 'object' && user.date && (
                    <span className="text-xs text-gray-400">
                      {new Date(user.date).toLocaleDateString('ko-KR')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
