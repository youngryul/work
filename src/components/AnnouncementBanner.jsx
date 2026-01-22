import { useState, useEffect } from 'react'
import { getUnreadAnnouncements, markAnnouncementAsRead } from '../services/announcementService.js'

/**
 * 공지사항 배너 컴포넌트
 * 읽지 않은 공지사항을 상단에 배너로 표시
 */
export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // 공지사항 조회
  useEffect(() => {
    loadAnnouncements()
  }, [])

  const loadAnnouncements = async () => {
    try {
      setIsLoading(true)
      const unreadAnnouncements = await getUnreadAnnouncements()
      setAnnouncements(unreadAnnouncements)
      setCurrentIndex(0)
    } catch (error) {
      console.error('공지사항 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 공지사항 닫기
  const handleClose = async (announcementId) => {
    try {
      await markAnnouncementAsRead(announcementId)
      // 현재 공지사항을 목록에서 제거
      setAnnouncements(prev => prev.filter(a => a.id !== announcementId))
      // 인덱스 조정
      if (currentIndex >= announcements.length - 1) {
        setCurrentIndex(Math.max(0, announcements.length - 2))
      }
    } catch (error) {
      console.error('공지사항 닫기 실패:', error)
    }
  }

  // 다음 공지사항으로 이동
  const handleNext = () => {
    if (announcements.length > 0) {
      setCurrentIndex((prev) => (prev + 1) % announcements.length)
    }
  }

  // 이전 공지사항으로 이동
  const handlePrev = () => {
    if (announcements.length > 0) {
      setCurrentIndex((prev) => (prev - 1 + announcements.length) % announcements.length)
    }
  }

  if (isLoading || announcements.length === 0) {
    return null
  }

  const currentAnnouncement = announcements[currentIndex]

  if (!currentAnnouncement) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* 이전 버튼 (공지사항이 여러 개일 때만 표시) */}
          {announcements.length > 1 && (
            <button
              onClick={handlePrev}
              className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="이전 공지사항"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          {/* 공지사항 내용 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded">
                공지사항
              </span>
              {currentAnnouncement.version && (
                <span className="text-xs opacity-90">
                  v{currentAnnouncement.version}
                </span>
              )}
              {announcements.length > 1 && (
                <span className="text-xs opacity-90">
                  ({currentIndex + 1}/{announcements.length})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm sm:text-base">
                {currentAnnouncement.title}
              </h3>
              {currentAnnouncement.content && (
                <p className="text-xs sm:text-sm opacity-90 truncate">
                  {currentAnnouncement.content}
                </p>
              )}
            </div>
          </div>

          {/* 다음 버튼 (공지사항이 여러 개일 때만 표시) */}
          {announcements.length > 1 && (
            <button
              onClick={handleNext}
              className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
              aria-label="다음 공지사항"
            >
              <svg
                className="w-5 h-5"
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
            </button>
          )}

          {/* 닫기 버튼 */}
          <button
            onClick={() => handleClose(currentAnnouncement.id)}
            className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="닫기"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
