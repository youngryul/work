import { useState, useEffect } from 'react'
import { getDataStatistics } from '../../services/adminStatisticsService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 데이터 통계 컴포넌트
 */
export default function DataStatistics() {
  const [statistics, setStatistics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStatistics()
  }, [])

  const loadStatistics = async () => {
    setLoading(true)
    try {
      const data = await getDataStatistics()
      setStatistics(data)
    } catch (error) {
      console.error('데이터 통계 로드 실패:', error)
      showToast('데이터 통계를 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
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
      {/* 일기 통계 */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 font-sans">📝 일기 통계</h3>
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1 font-sans">총 일기 작성 수</p>
            <p className="text-3xl font-bold text-blue-600 font-sans">
              {statistics.diaries.total.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* 할 일 통계 */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 font-sans">✅ 할 일 통계</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1 font-sans">총 할 일 수</p>
            <p className="text-3xl font-bold text-green-600 font-sans">
              {statistics.tasks.total.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1 font-sans">완료된 할 일</p>
            <p className="text-3xl font-bold text-blue-600 font-sans">
              {statistics.tasks.completed.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1 font-sans">완료율</p>
            <p className="text-3xl font-bold text-purple-600 font-sans">
              {statistics.tasks.completionRate.toFixed(1)}%
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-gray-200 rounded-full h-8">
              <div
                className="bg-green-500 h-8 rounded-full flex items-center justify-center text-white font-semibold font-sans"
                style={{
                  width: `${Math.min(statistics.tasks.completionRate, 100)}%`,
                }}
              >
                {statistics.tasks.completionRate.toFixed(1)}%
              </div>
            </div>
            <span className="text-sm text-gray-600 font-sans">
              {statistics.tasks.completed} / {statistics.tasks.total}
            </span>
          </div>
        </div>
      </div>

      {/* 5년 질문 통계 */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 font-sans">📖 5년 질문 통계</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1 font-sans">총 질문 수</p>
            <p className="text-3xl font-bold text-yellow-600 font-sans">
              {statistics.fiveYearQuestions.totalQuestions.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1 font-sans">총 답변 수</p>
            <p className="text-3xl font-bold text-orange-600 font-sans">
              {statistics.fiveYearQuestions.totalAnswers.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1 font-sans">답변률</p>
            <p className="text-3xl font-bold text-red-600 font-sans">
              {statistics.fiveYearQuestions.answerRate.toFixed(1)}%
            </p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-gray-200 rounded-full h-8">
              <div
                className="bg-red-500 h-8 rounded-full flex items-center justify-center text-white font-semibold font-sans"
                style={{
                  width: `${Math.min(statistics.fiveYearQuestions.answerRate, 100)}%`,
                }}
              >
                {statistics.fiveYearQuestions.answerRate.toFixed(1)}%
              </div>
            </div>
            <span className="text-sm text-gray-600 font-sans">
              {statistics.fiveYearQuestions.totalAnswers} /{' '}
              {statistics.fiveYearQuestions.totalQuestions}
            </span>
          </div>
        </div>
      </div>

      {/* 독서 통계 */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 font-sans">📚 독서 통계</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1 font-sans">총 독서 기록 수</p>
            <p className="text-3xl font-bold text-green-700 font-sans">
              {statistics.reading.totalRecords.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1 font-sans">총 읽은 페이지 수</p>
            <p className="text-3xl font-bold text-green-600 font-sans">
              {statistics.reading.totalPages.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
