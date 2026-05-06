import { useState, useEffect } from 'react'
import { getAllBucketlists, createBucketlist, updateBucketlist, deleteBucketlist, getCompletedBucketlistsByYear, getMonthlyCompletionTimeline } from '../../services/bucketlistService.js'
import { BUCKETLIST_STATUS, BUCKETLIST_STATUS_LABELS } from '../../constants/bucketlistConstants.js'
import BucketlistCard from './BucketlistCard.jsx'
import BucketlistForm from './BucketlistForm.jsx'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 버킷리스트 메인 화면 컴포넌트
 */
export default function BucketlistView() {
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'reflection'
  const [bucketlists, setBucketlists] = useState([])
  const [filteredBucketlists, setFilteredBucketlists] = useState([])
  const [selectedStatus, setSelectedStatus] = useState(BUCKETLIST_STATUS.NOT_COMPLETED)
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingBucketlist, setEditingBucketlist] = useState(null)
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false)
  const [completedTitle, setCompletedTitle] = useState('')
  
  // 회고 관련 상태
  const [year, setYear] = useState(new Date().getFullYear())
  const [completedBucketlists, setCompletedBucketlists] = useState([])
  const [monthlyTimeline, setMonthlyTimeline] = useState({})
  const [isLoadingReflection, setIsLoadingReflection] = useState(false)

  /**
   * 버킷리스트 목록 로드
   */
  const loadBucketlists = async () => {
    setIsLoading(true)
    try {
      const data = await getAllBucketlists()
      console.log('[버킷리스트 뷰] 로드된 데이터:', data)
      setBucketlists(data)
      filterBucketlists(data, selectedStatus)
    } catch (error) {
      console.error('버킷리스트 로드 오류:', error)
      showToast(`버킷리스트를 불러오는데 실패했습니다: ${error.message || '알 수 없는 오류'}`, TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 상태별 필터링
   */
  const filterBucketlists = (data, status) => {
    if (!status) {
      setFilteredBucketlists(data)
    } else {
      setFilteredBucketlists(data.filter((item) => item.status === status))
    }
  }

  useEffect(() => {
    loadBucketlists()
  }, [])

  useEffect(() => {
    filterBucketlists(bucketlists, selectedStatus)
  }, [selectedStatus, bucketlists])

  /**
   * 버킷리스트 추가
   */
  const handleAdd = () => {
    setEditingBucketlist(null)
    setShowForm(true)
  }

  /**
   * 버킷리스트 수정
   */
  const handleEdit = (bucketlist) => {
    setEditingBucketlist(bucketlist)
    setShowForm(true)
  }

  /**
   * 버킷리스트 저장
   */
  const handleSave = async (bucketlistData) => {
    try {
      if (editingBucketlist) {
        await updateBucketlist(editingBucketlist.id, bucketlistData)
      } else {
        await createBucketlist(bucketlistData)
      }
      setShowForm(false)
      setEditingBucketlist(null)
      await loadBucketlists()
    } catch (error) {
      console.error('버킷리스트 저장 오류:', error)
      showToast(error.message || '저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 버킷리스트 삭제
   */
  const handleDelete = async (id) => {
    try {
      await deleteBucketlist(id)
      await loadBucketlists()
    } catch (error) {
      console.error('버킷리스트 삭제 오류:', error)
      showToast('삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 상태 변경
   */
  const handleStatusChange = async (id, newStatus) => {
    try {
      const previousBucketlist = bucketlists.find((b) => b.id === id)
      const wasCompleted = previousBucketlist?.status === BUCKETLIST_STATUS.COMPLETED
      const isNowCompleted = newStatus === BUCKETLIST_STATUS.COMPLETED

      // 완료 상태로 변경 시 제목 저장 (애니메이션용)
      if (!wasCompleted && isNowCompleted) {
        setCompletedTitle(previousBucketlist?.title || '')
      }

      await updateBucketlist(id, { status: newStatus })

      // 완료 상태로 변경 시 성취감 UX 표시 (팡파레 애니메이션)
      if (!wasCompleted && isNowCompleted) {
        setShowCompletionCelebration(true)
        setTimeout(() => {
          setShowCompletionCelebration(false)
        }, 2500)
      }

      await loadBucketlists()
    } catch (error) {
      console.error('상태 변경 오류:', error)
      showToast('상태 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 상태별 개수 계산
   */
  const getStatusCount = (status) => {
    return bucketlists.filter((b) => b.status === status).length
  }

  /**
   * 회고 데이터 로드
   */
  const loadReflectionData = async () => {
    setIsLoadingReflection(true)
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
      setIsLoadingReflection(false)
    }
  }

  /**
   * 탭 변경 시 회고 데이터 로드
   */
  useEffect(() => {
    if (activeTab === 'reflection') {
      loadReflectionData()
    }
  }, [activeTab, year])

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-handwriting text-gray-800 mb-2">
              버킷리스트
            </h1>
          </div>
          {activeTab === 'list' && (
            <button
              onClick={handleAdd}
              className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors duration-200 text-xl font-medium shadow-md"
            >
              + 새 버킷리스트
            </button>
          )}
        </div>

        {/* 탭 메뉴 */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-6 py-3 transition-colors duration-200 text-lg font-medium border-b-2 ${
              activeTab === 'list'
                ? 'border-emerald-500 text-emerald-600 font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            버킷리스트
          </button>
          <button
            onClick={() => setActiveTab('reflection')}
            className={`px-6 py-3 transition-colors duration-200 text-lg font-medium border-b-2 ${
              activeTab === 'reflection'
                ? 'border-purple-500 text-purple-600 font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            💭 회고
          </button>
        </div>

        {/* 상태 필터 (리스트 탭에서만 표시) */}
        {activeTab === 'list' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500 mr-2">필터:</span>
            <button
              onClick={() => setSelectedStatus(BUCKETLIST_STATUS.NOT_COMPLETED)}
              className={`px-4 py-1.5 rounded-full transition-colors duration-200 text-sm font-medium border-2 ${
                selectedStatus === BUCKETLIST_STATUS.NOT_COMPLETED
                  ? 'bg-orange-50 border-orange-500 text-orange-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-orange-300 hover:bg-orange-50'
              }`}
            >
              미완료 ({getStatusCount(BUCKETLIST_STATUS.NOT_COMPLETED)})
            </button>
            <button
              onClick={() => setSelectedStatus(BUCKETLIST_STATUS.COMPLETED)}
              className={`px-4 py-1.5 rounded-full transition-colors duration-200 text-sm font-medium border-2 ${
                selectedStatus === BUCKETLIST_STATUS.COMPLETED
                  ? 'bg-green-50 border-green-500 text-green-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-green-300 hover:bg-green-50'
              }`}
            >
              완료 ({getStatusCount(BUCKETLIST_STATUS.COMPLETED)})
            </button>
            <button
              onClick={() => setSelectedStatus(null)}
              className={`px-4 py-1.5 rounded-full transition-colors duration-200 text-sm font-medium border-2 ${
                selectedStatus === null
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              전체 ({bucketlists.length})
            </button>
          </div>
        )}
      </div>

      {/* 완료 축하 애니메이션 (팡파레) */}
      {showCompletionCelebration && (
        <>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 pointer-events-none">
            {/* 팡파레 효과 */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(30)].map((_, i) => {
                const angle = (i * 360) / 30
                const distance = 200 + Math.random() * 100
                const delay = Math.random() * 0.5
                const colors = ['bg-yellow-400', 'bg-blue-400', 'bg-green-400', 'bg-green-400', 'bg-purple-400', 'bg-orange-400']
                return (
                  <div
                    key={i}
                    className={`absolute w-3 h-3 rounded-full ${colors[i % colors.length]}`}
                    style={{
                      left: '50%',
                      top: '50%',
                      transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${distance}px)`,
                      animation: `confetti-fall 1.5s ease-out ${delay}s forwards`,
                    }}
                  />
                )
              })}
            </div>

            {/* 중앙 메시지 */}
            <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4 text-center relative z-10 animate-bounce pointer-events-auto">
              <div className="text-6xl mb-4 animate-pulse">🎉</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">축하합니다!</h2>
              <p className="text-xl text-gray-600 mb-4">{completedTitle}</p>
              <p className="text-lg text-blue-600 font-semibold">버킷리스트를 완료했습니다! 🎊</p>
            </div>
          </div>

          <style>{`
            @keyframes confetti-fall {
              0% {
                transform: translate(-50%, -50%) rotate(var(--angle, 0deg)) translateY(0);
                opacity: 1;
              }
              100% {
                transform: translate(-50%, -50%) rotate(var(--angle, 0deg)) translateY(500px);
                opacity: 0;
              }
            }
          `}</style>
        </>
      )}

      {/* 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
            <BucketlistForm
              initialData={editingBucketlist}
              onSave={handleSave}
              onCancel={() => {
                setShowForm(false)
                setEditingBucketlist(null)
              }}
            />
          </div>
        </div>
      )}

      {/* 컨텐츠 영역 */}
      {activeTab === 'list' ? (
        /* 버킷리스트 목록 */
        <>
          {isLoading ? (
            <div className="text-center py-12 text-gray-500 text-2xl">로딩 중...</div>
          ) : filteredBucketlists.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-2xl">
              {selectedStatus
                ? `${BUCKETLIST_STATUS_LABELS[selectedStatus]} 상태의 버킷리스트가 없습니다.`
                : '버킷리스트가 없습니다. 새 버킷리스트를 추가해보세요! ✨'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBucketlists.map((bucketlist) => (
                <BucketlistCard
                  key={bucketlist.id}
                  bucketlist={bucketlist}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* 회고 탭 */
        <>
          {isLoadingReflection ? (
            <div className="text-center py-12 text-gray-500 text-2xl">로딩 중...</div>
          ) : (
            <>
              {/* 연도 선택 */}
              <div className="mb-6">
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
                                className="absolute bottom-0 w-full bg-emerald-500 rounded-t-lg transition-all duration-500 flex items-end justify-center"
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
        </>
      )}
    </div>
  )
}

