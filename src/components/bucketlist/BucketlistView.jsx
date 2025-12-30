import { useState, useEffect } from 'react'
import { getAllBucketlists, createBucketlist, updateBucketlist, deleteBucketlist } from '../../services/bucketlistService.js'
import { BUCKETLIST_STATUS, BUCKETLIST_STATUS_LABELS } from '../../constants/bucketlistConstants.js'
import BucketlistCard from './BucketlistCard.jsx'
import BucketlistForm from './BucketlistForm.jsx'

/**
 * 버킷리스트 메인 화면 컴포넌트
 */
export default function BucketlistView() {
  const [bucketlists, setBucketlists] = useState([])
  const [filteredBucketlists, setFilteredBucketlists] = useState([])
  const [selectedStatus, setSelectedStatus] = useState(BUCKETLIST_STATUS.NOT_COMPLETED)
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingBucketlist, setEditingBucketlist] = useState(null)
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false)
  const [completedTitle, setCompletedTitle] = useState('')

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
      alert(`버킷리스트를 불러오는데 실패했습니다: ${error.message || '알 수 없는 오류'}`)
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
      alert(error.message || '저장에 실패했습니다.')
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
      alert('삭제에 실패했습니다.')
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
      alert('상태 변경에 실패했습니다.')
    }
  }

  /**
   * 상태별 개수 계산
   */
  const getStatusCount = (status) => {
    return bucketlists.filter((b) => b.status === status).length
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-6xl font-handwriting text-gray-800 mb-2">
              버킷리스트
            </h1>
          </div>
          <button
            onClick={handleAdd}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-xl font-medium shadow-md"
          >
            + 새 버킷리스트
          </button>
        </div>

        {/* 상태 필터 */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setSelectedStatus(BUCKETLIST_STATUS.NOT_COMPLETED)}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 text-base font-medium ${
              selectedStatus === BUCKETLIST_STATUS.NOT_COMPLETED
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            미완료 ({getStatusCount(BUCKETLIST_STATUS.NOT_COMPLETED)})
          </button>
          <button
            onClick={() => setSelectedStatus(BUCKETLIST_STATUS.COMPLETED)}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 text-base font-medium ${
              selectedStatus === BUCKETLIST_STATUS.COMPLETED
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            완료 ({getStatusCount(BUCKETLIST_STATUS.COMPLETED)})
          </button>
          <button
            onClick={() => setSelectedStatus(null)}
            className={`px-4 py-2 rounded-lg transition-colors duration-200 text-base font-medium ${
              selectedStatus === null
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            전체 ({bucketlists.length})
          </button>
        </div>
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
                const colors = ['bg-yellow-400', 'bg-blue-400', 'bg-pink-400', 'bg-green-400', 'bg-purple-400', 'bg-orange-400']
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

      {/* 버킷리스트 목록 */}
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
    </div>
  )
}

