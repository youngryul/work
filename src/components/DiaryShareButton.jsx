import { useState } from 'react'
import { isMobileDevice } from '../utils/isMobileDevice.js'
import { shareDiaryImageToInstagramStory } from '../utils/instagramStoryShare.js'
import DiaryShareCardModal from './DiaryShareCardModal.jsx'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * 일기 AI 이미지 공유 버튼
 * - 모바일: 인스타 스토리 공유
 * - 웹: 일기 사진 카드 모달 (링크 복사 · 이미지 저장)
 * @param {{
 *   imageUrl: string,
 *   dateString?: string,
 *   emotionLabel?: string,
 *   className?: string,
 *   size?: 'sm' | 'md',
 * }} props
 */
export default function DiaryShareButton({
  imageUrl,
  dateString,
  emotionLabel,
  className = '',
  size = 'md',
}) {
  const [isSharing, setIsSharing] = useState(false)
  const [isCardModalOpen, setIsCardModalOpen] = useState(false)
  const isMobile = isMobileDevice()

  const sizeClass =
    size === 'sm'
      ? 'px-3 py-1.5 text-sm'
      : 'px-4 py-2 text-sm'

  const handleMobileShare = async () => {
    if (!imageUrl || isSharing) return

    setIsSharing(true)
    try {
      const method = await shareDiaryImageToInstagramStory(imageUrl, {
        dateString,
        emotionLabel,
      })

      if (method === 'share') {
        showToast(
          '공유 메뉴에서 인스타그램 스토리를 선택해 주세요.',
          TOAST_TYPES.SUCCESS,
        )
      } else {
        showToast(
          '스토리 이미지가 저장되었습니다. 인스타그램 앱에서 스토리에 추가해 주세요.',
          TOAST_TYPES.SUCCESS,
        )
      }
    } catch (error) {
      if (error?.name === 'AbortError') return
      console.error('인스타 스토리 공유 오류:', error)
      showToast(
        error?.message || '스토리 공유에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        TOAST_TYPES.ERROR,
      )
    } finally {
      setIsSharing(false)
    }
  }

  if (isMobile) {
    return (
      <button
        type="button"
        onClick={handleMobileShare}
        disabled={isSharing}
        className={`inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white font-medium font-sans shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 ${sizeClass} ${className}`}
        title="인스타그램 스토리에 공유"
      >
        <span aria-hidden="true">📸</span>
        {isSharing ? '준비 중...' : '스토리에 공유'}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsCardModalOpen(true)}
        className={`inline-flex items-center gap-2 rounded-lg bg-green-500 text-white font-medium font-sans shadow-sm hover:bg-green-600 transition-colors ${sizeClass} ${className}`}
        title="일기 사진 카드 만들기"
      >
        <span aria-hidden="true">🖼️</span>
        공유 카드
      </button>

      <DiaryShareCardModal
        isOpen={isCardModalOpen}
        onClose={() => setIsCardModalOpen(false)}
        imageUrl={imageUrl}
        dateString={dateString}
        emotionLabel={emotionLabel}
      />
    </>
  )
}
