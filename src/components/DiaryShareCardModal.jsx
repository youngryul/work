import { useEffect, useState } from 'react'
import { createDiaryShareCardBlob, downloadDiaryShareCard } from '../utils/diaryShareCard.js'
import { buildDiaryShareLink, copyTextToClipboard } from '../utils/diaryShareLink.js'
import { formatDiaryDateLabel } from '../utils/formatDiaryDateLabel.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * 웹용 일기 사진 카드 미리보기 모달
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   imageUrl: string,
 *   dateString?: string,
 *   emotionLabel?: string,
 * }} props
 */
export default function DiaryShareCardModal({
  isOpen,
  onClose,
  imageUrl,
  dateString,
  emotionLabel,
}) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isCopying, setIsCopying] = useState(false)

  const shareLink = dateString ? buildDiaryShareLink(dateString) : buildDiaryShareLink('')
  const dateLabel = dateString ? formatDiaryDateLabel(dateString) : ''

  useEffect(() => {
    if (!isOpen || !imageUrl) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return ''
      })
      return undefined
    }

    let cancelled = false
    setIsLoading(true)

    createDiaryShareCardBlob(imageUrl, { dateString, emotionLabel })
      .then((blob) => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      })
      .catch((error) => {
        console.error('일기 카드 미리보기 오류:', error)
        if (!cancelled) {
          showToast('카드를 불러오지 못했습니다.', TOAST_TYPES.ERROR)
          onClose()
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, imageUrl, dateString, emotionLabel, onClose])

  useEffect(() => {
    if (!isOpen) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return ''
      })
    }
  }, [isOpen])

  const handleCopyLink = async () => {
    setIsCopying(true)
    try {
      await copyTextToClipboard(shareLink)
      showToast('공유 링크가 복사되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('링크 복사 오류:', error)
      showToast(error?.message || '링크 복사에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsCopying(false)
    }
  }

  const handleSaveImage = async () => {
    setIsSaving(true)
    try {
      await downloadDiaryShareCard(imageUrl, { dateString, emotionLabel })
      showToast('카드 이미지가 저장되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('카드 저장 오류:', error)
      showToast(error?.message || '이미지 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="diary-share-card-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 id="diary-share-card-title" className="text-xl font-bold text-gray-800 font-sans">
            일기 사진 카드
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            {isLoading ? (
              <div className="flex items-center justify-center h-80 text-gray-500 font-sans">
                카드 만드는 중...
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="일기 공유 카드 미리보기"
                className="w-full rounded-lg shadow-sm"
              />
            ) : null}
          </div>

          {(dateLabel || emotionLabel) && (
            <div className="text-sm text-gray-600 font-sans space-y-1">
              {dateLabel && <p>{dateLabel}</p>}
              {emotionLabel && <p>오늘의 감정 · {emotionLabel}</p>}
            </div>
          )}

          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-xs text-green-800 font-sans mb-1">공유 링크</p>
            <p className="text-sm text-gray-700 break-all font-sans">{shareLink}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={isCopying || isLoading}
              className="flex-1 min-w-[140px] px-4 py-2.5 rounded-lg bg-green-500 text-white font-medium font-sans hover:bg-green-600 disabled:opacity-50"
            >
              {isCopying ? '복사 중...' : '🔗 링크 복사'}
            </button>
            <button
              type="button"
              onClick={handleSaveImage}
              disabled={isSaving || isLoading}
              className="flex-1 min-w-[140px] px-4 py-2.5 rounded-lg border-2 border-green-400 text-green-700 font-medium font-sans hover:bg-green-50 disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : '💾 이미지 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
