import { useState, useEffect } from 'react'
import { getCompletedBucketlistsByYear, getMonthlyCompletionTimeline } from '../../services/bucketlistService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 버킷리스트 회고 화면 컴포넌트
 */
export default function BucketlistReflectionView() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [completedBucketlists, setCompletedBucketlists] = useState([])
  const [monthlyTimeline, setMonthlyTimeline] = useState({})
  const [isLoading, setIsLoading] = useState(true)

  /**
   * 데이터 로드
   */
  const loadData = async () => {
    setIsLoading(true)
    try {
      const [completed, timeline] = await Promise.all([
        getCompletedBucketlistsByYear(year),
        getMonthlyCompletionTimeline(year),
      ])

      setCompletedBucketlists(completed)
      setMonthlyTimeline(timeline)
    } catch (error) {
      console.error('회고 데이터 로드 오류:', error)
      showToast('데이터를 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [year])

  /**
   * 월별 완료 개수 가져오기
   */
  const getMonthCount = (month) => {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`
    return monthlyTimeline[monthKey] || 0
  }

  /**
   * 최대 완료 개수 (차트 높이 계산용)
   */
  const maxCount = Math.max(...Object.values(monthlyTimeline), 1)

  /**
   * 월 이름
   */
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-4xl font-handwriting text-gray-800 mb-2">
          올해 내가 이룬 버킷리스트
        </h1>
        <div className="flex items-center gap-4">
          <label className="text-xl text-gray-600">연도 선택:</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 text-2xl">로딩 중...</div>
      ) : (
        <>
          {/* 통계 요약 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {completedBucketlists.length}
              </div>
              <div className="text-xl text-gray-700">완료한 버킷리스트</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
              <div className="text-4xl font-bold text-purple-600 mb-2">
                {Object.values(monthlyTimeline).reduce((sum, count) => sum + count, 0)}
              </div>
              <div className="text-xl text-gray-700">월별 완료 총계</div>
            </div>
          </div>

          {/* 월별 완료 타임라인 */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">월별 완료 타임라인</h2>
            {Object.keys(monthlyTimeline).length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xl">
                {year}년에는 완료한 버킷리스트가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-4">
                {monthNames.map((monthName, index) => {
                  const month = index + 1
                  const count = getMonthCount(month)
                  const height = maxCount > 0 ? (count / maxCount) * 100 : 0

                  return (
                    <div key={month} className="flex flex-col items-center">
                      <div className="w-full bg-gray-200 rounded-t-lg relative" style={{ height: '200px' }}>
                        {count > 0 && (
                          <div
                            className="absolute bottom-0 w-full bg-blue-500 rounded-t-lg transition-all duration-500 flex items-end justify-center"
                            style={{ height: `${height}%` }}
                          >
                            <span className="text-white font-bold text-sm mb-1">{count}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-sm text-gray-600 font-medium">{monthName}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 완료한 버킷리스트 목록 */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">완료한 버킷리스트 목록</h2>
            {completedBucketlists.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xl">
                {year}년에는 완료한 버킷리스트가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {completedBucketlists.map((bucketlist) => {
                  const completedDate = new Date(bucketlist.completedAt)
                  const formattedDate = `${completedDate.getFullYear()}년 ${completedDate.getMonth() + 1}월 ${completedDate.getDate()}일`

                  return (
                    <div
                      key={bucketlist.id}
                      className="flex items-start gap-4 p-4 bg-green-50 rounded-lg border border-green-200"
                    >
                      <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xl">✓</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 mb-1">{bucketlist.title}</h3>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-gray-500 text-sm">완료일: {formattedDate}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
