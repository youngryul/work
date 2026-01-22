import { useState, useEffect } from 'react'
import { getAllActiveAnnouncements, markAnnouncementAsRead } from '../services/announcementService.js'
import { getUnreadAnnouncements } from '../services/announcementService.js'

/**
 * 공지사항 목록 뷰 컴포넌트
 * 모든 활성 공지사항을 표시하고 읽음 처리
 */
export default function AnnouncementView() {
  const [announcements, setAnnouncements] = useState([])
  const [unreadIds, setUnreadIds] = useState(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)

  // 공지사항 조회
  useEffect(() => {
    loadAnnouncements()
  }, [])

  const loadAnnouncements = async () => {
    try {
      setIsLoading(true)
      
      // 모든 활성 공지사항 조회
      const allAnnouncements = await getAllActiveAnnouncements()
      setAnnouncements(allAnnouncements)
      
      // 읽지 않은 공지사항 ID 목록 조회
      const unreadAnnouncements = await getUnreadAnnouncements()
      const unreadSet = new Set(unreadAnnouncements.map(a => a.id))
      setUnreadIds(unreadSet)
    } catch (error) {
      console.error('공지사항 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 공지사항 읽음 처리
  const handleMarkAsRead = async (announcementId) => {
    try {
      await markAnnouncementAsRead(announcementId)
      setUnreadIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(announcementId)
        return newSet
      })
    } catch (error) {
      console.error('공지사항 읽음 처리 실패:', error)
    }
  }

  // 공지사항 클릭
  const handleAnnouncementClick = (announcement) => {
    setSelectedAnnouncement(announcement)
    if (unreadIds.has(announcement.id)) {
      handleMarkAsRead(announcement.id)
    }
  }

  // 상세 보기 닫기
  const handleCloseDetail = () => {
    setSelectedAnnouncement(null)
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-sans">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 font-sans">공지사항</h1>
        <p className="text-gray-600 font-sans">
          {announcements.length > 0 
            ? `총 ${announcements.length}개의 공지사항이 있습니다.`
            : '공지사항이 없습니다.'}
        </p>
      </div>

      {/* 공지사항 목록 */}
      {announcements.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 font-sans">표시할 공지사항이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((announcement) => {
            const isUnread = unreadIds.has(announcement.id)
            return (
              <div
                key={announcement.id}
                className={`
                  bg-white rounded-lg shadow-md p-6 cursor-pointer
                  transition-all duration-200 hover:shadow-lg
                  ${isUnread ? 'border-l-4 border-blue-500' : 'border-l-4 border-transparent'}
                `}
                onClick={() => handleAnnouncementClick(announcement)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-800 font-sans">
                        {announcement.title}
                      </h3>
                      {isUnread && (
                        <span className="flex-shrink-0 bg-blue-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                          새
                        </span>
                      )}
                      {announcement.version && (
                        <span className="flex-shrink-0 bg-gray-100 text-gray-600 text-xs font-medium px-2 py-1 rounded">
                          v{announcement.version}
                        </span>
                      )}
                    </div>
                    {announcement.content && (
                      <p className="text-gray-600 font-sans mb-3 line-clamp-2">
                        {announcement.content}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500 font-sans">
                      <span>
                        {new Date(announcement.created_at).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                      {announcement.expires_at && (
                        <span>
                          만료: {new Date(announcement.expires_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 상세 보기 모달 */}
      {selectedAnnouncement && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={handleCloseDetail}
          />
          
          {/* 모달 */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* 헤더 */}
              <div className="flex items-start justify-between p-6 border-b border-gray-200">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-bold text-gray-800 font-sans">
                      {selectedAnnouncement.title}
                    </h2>
                    {selectedAnnouncement.version && (
                      <span className="bg-gray-100 text-gray-600 text-sm font-medium px-3 py-1 rounded">
                        v{selectedAnnouncement.version}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 font-sans">
                    {new Date(selectedAnnouncement.created_at).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <button
                  onClick={handleCloseDetail}
                  className="flex-shrink-0 text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>

              {/* 내용 */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="prose max-w-none">
                  <p className="text-gray-700 font-sans whitespace-pre-wrap leading-relaxed">
                    {selectedAnnouncement.content}
                  </p>
                </div>
              </div>

              {/* 푸터 */}
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={handleCloseDetail}
                  className="w-full px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-sans"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
