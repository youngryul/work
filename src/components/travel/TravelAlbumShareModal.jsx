import { useEffect, useState } from 'react'
import {
  createTravelAlbumImageBlob,
  downloadTravelAlbumImage,
  shareTravelAlbumImage,
} from '../../utils/travelAlbumImage.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 여행 앨범 이미지 미리보기 + 저장/공유 모달
 * @param {{ onClose: () => void, title: string, periodLabel?: string, photos: Array }} props
 */
export default function TravelAlbumShareModal({ onClose, title, periodLabel = '', photos }) {
  const [blob, setBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSharing, setIsSharing] = useState(false)
  const canShareFiles = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''

    createTravelAlbumImageBlob({ title, periodLabel, photos })
      .then((result) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(result)
        setBlob(result)
        setPreviewUrl(objectUrl)
      })
      .catch((error) => {
        console.error('앨범 이미지 생성 오류:', error)
        if (!cancelled) {
          showToast(error?.message || '앨범 이미지를 만들지 못했습니다.', TOAST_TYPES.ERROR)
          onClose()
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
    // 모달이 열릴 때 한 번만 생성
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = () => {
    if (!blob) return
    downloadTravelAlbumImage(blob, title)
    showToast('앨범 이미지를 저장했습니다.', TOAST_TYPES.SUCCESS)
  }

  const handleShare = async () => {
    if (!blob) return
    setIsSharing(true)
    try {
      const shared = await shareTravelAlbumImage(blob, title)
      if (!shared) {
        // 공유 미지원 브라우저(대부분의 PC)는 저장으로 대체
        downloadTravelAlbumImage(blob, title)
        showToast('이 브라우저는 바로 공유를 지원하지 않아 이미지로 저장했습니다.', TOAST_TYPES.INFO)
      }
    } catch (error) {
      // 사용자가 공유 시트를 닫은 경우는 무시
      if (error?.name !== 'AbortError') {
        console.error('앨범 공유 오류:', error)
        showToast('공유에 실패했습니다.', TOAST_TYPES.ERROR)
      }
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="travel-album-share-title"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 id="travel-album-share-title" className="text-xl font-bold text-gray-800">
            앨범 이미지로 저장 · 공유
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

        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            {isLoading ? (
              <div className="flex items-center justify-center h-80 text-gray-500">앨범 이미지 만드는 중...</div>
            ) : previewUrl ? (
              <img src={previewUrl} alt="여행 앨범 이미지 미리보기" className="w-full rounded-lg shadow-sm" />
            ) : null}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            사진 {photos.filter((photo) => !photo.isLocal).length}장과 한줄 메모가 한 장의 이미지로 저장돼요.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || !blob}
            className="flex-1 min-w-[140px] px-4 py-2.5 rounded-lg border-2 border-rose-400 text-rose-600 font-medium hover:bg-rose-50 disabled:opacity-50"
          >
            💾 이미지 저장
          </button>
          {canShareFiles && (
            <button
              type="button"
              onClick={handleShare}
              disabled={isLoading || !blob || isSharing}
              className="flex-1 min-w-[140px] px-4 py-2.5 rounded-lg bg-rose-500 text-white font-medium hover:bg-rose-600 disabled:opacity-50"
            >
              {isSharing ? '공유 중...' : '📤 공유하기'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
