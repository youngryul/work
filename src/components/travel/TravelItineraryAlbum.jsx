import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TRAVEL_ALBUM_MAX_PHOTOS } from '../../constants/travelConstants.js'
import {
  createAbroadAlbumPhotosBatch,
  deleteAbroadAlbumPhoto,
  getAbroadAlbumPhotos,
  recompressAbroadAlbumPhotos,
  updateAbroadAlbumPhoto,
} from '../../services/travelItineraryService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/** 폴라로이드 기울기 (id 기반 고정) */
const POLAROID_ROTATIONS = [-7, -4, -2, 1, 3, 5, -5, 2, -1, 6]

/**
 * @param {string} id
 * @param {number} index
 */
function getPolaroidRotation(id, index) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % POLAROID_ROTATIONS.length
  }
  return POLAROID_ROTATIONS[(hash + index) % POLAROID_ROTATIONS.length]
}

/**
 * 여행 폴라로이드 앨범
 * @param {{ albumId: string, tripId?: string|null, albumTitle?: string, periodLabel?: string, initialPhotos?: Array }} props
 */
export default function TravelItineraryAlbum({
  albumId,
  tripId = null,
  albumTitle = '',
  periodLabel = '',
  initialPhotos,
}) {
  const [photos, setPhotos] = useState(() => initialPhotos || [])
  const [isLoading, setIsLoading] = useState(!initialPhotos)
  const [isUploading, setIsUploading] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [compressProgress, setCompressProgress] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editingCaption, setEditingCaption] = useState('')
  const [savingId, setSavingId] = useState(null)
  const fileInputRef = useRef(null)
  const previewUrlsRef = useRef([])

  const remaining = TRAVEL_ALBUM_MAX_PHOTOS - photos.length
  const albumLabel = useMemo(() => {
    const base = (albumTitle || '').trim()
    return base ? `${base} dump` : 'travel dump'
  }, [albumTitle])

  const revokePreviewUrls = () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    previewUrlsRef.current = []
  }

  const loadPhotos = useCallback(async () => {
    if (!initialPhotos) setIsLoading(true)
    try {
      const data = await getAbroadAlbumPhotos(albumId)
      setPhotos(data)
      return data
    } catch (error) {
      showToast(error?.message || '앨범을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [albumId, initialPhotos])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const data = await loadPhotos()
      if (cancelled) return
      const needsCompress = (data || []).some((photo) => !photo.isCompressed && photo.imageUrl)
      if (!needsCompress) return
      setIsCompressing(true)
      try {
        const changed = await recompressAbroadAlbumPhotos(albumId, setCompressProgress)
        if (cancelled || changed.length === 0) return
        setPhotos((prev) =>
          prev.map((photo) => changed.find((item) => item.id === photo.id) || photo),
        )
        showToast(`기존 사진 ${changed.length}장 용량을 줄였습니다.`, TOAST_TYPES.SUCCESS)
      } catch (error) {
        if (!cancelled) console.warn('기존 사진 압축 실패:', error)
      } finally {
        if (!cancelled) {
          setIsCompressing(false)
          setCompressProgress(null)
        }
      }
    }
    init()
    return () => {
      cancelled = true
      revokePreviewUrls()
    }
  }, [loadPhotos, albumId])

  const handleUploadFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'))
    if (files.length === 0) {
      showToast('이미지 파일을 선택해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (remaining <= 0) {
      showToast(`앨범은 최대 ${TRAVEL_ALBUM_MAX_PHOTOS}장입니다.`, TOAST_TYPES.ERROR)
      return
    }

    const filesToUpload = files.slice(0, remaining)
    const extraSkipped = files.length - filesToUpload.length
    const previewItems = filesToUpload.map((file, index) => {
      const imageUrl = URL.createObjectURL(file)
      previewUrlsRef.current.push(imageUrl)
      return {
        id: `local-${Date.now()}-${index}`,
        imageUrl,
        caption: '',
        isLocal: true,
      }
    })

    setIsUploading(true)
    setUploadProgress({ phase: 'compress', completed: 0, total: filesToUpload.length })
    setPhotos((prev) => [...prev, ...previewItems])
    try {
      const { created, skipped } = await createAbroadAlbumPhotosBatch({
        albumId,
        tripId,
        imageFiles: filesToUpload,
        onProgress: setUploadProgress,
      })
      revokePreviewUrls()
      setPhotos((prev) => [...prev.filter((row) => !row.isLocal), ...created])
      const skippedCount = skipped + extraSkipped
      if (skippedCount > 0) {
        showToast(
          `${created.length}장 추가 · ${skippedCount}장은 한도(${TRAVEL_ALBUM_MAX_PHOTOS}장)로 제외`,
          TOAST_TYPES.INFO,
        )
      } else {
        showToast(`${created.length}장을 앨범에 추가했습니다.`, TOAST_TYPES.SUCCESS)
      }
    } catch (error) {
      revokePreviewUrls()
      setPhotos((prev) => prev.filter((row) => !row.isLocal))
      showToast(error?.message || '사진 업로드에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePaste = (event) => {
    if (remaining <= 0 || isUploading || isCompressing) return
    const files = Array.from(event.clipboardData?.files || []).filter((file) =>
      file.type.startsWith('image/'),
    )
    if (files.length === 0) return
    event.preventDefault()
    handleUploadFiles(files)
  }

  const startEditCaption = (photo) => {
    if (photo.isLocal) return
    setEditingId(photo.id)
    setEditingCaption(photo.caption || '')
  }

  const saveCaption = async (photoId) => {
    if (savingId) return
    setSavingId(photoId)
    try {
      const updated = await updateAbroadAlbumPhoto(photoId, { caption: editingCaption })
      setPhotos((prev) => prev.map((row) => (row.id === photoId ? updated : row)))
      setEditingId(null)
      setEditingCaption('')
      showToast('한줄을 저장했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error?.message || '저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setSavingId(null)
    }
  }

  const handleDelete = async (photo) => {
    if (photo.isLocal) return
    if (!window.confirm('이 사진을 앨범에서 삭제할까요?')) return
    try {
      await deleteAbroadAlbumPhoto(photo.id)
      setPhotos((prev) => prev.filter((row) => row.id !== photo.id))
      if (editingId === photo.id) {
        setEditingId(null)
        setEditingCaption('')
      }
      showToast('사진을 삭제했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error?.message || '삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const uploadButtonLabel = (() => {
    if (!isUploading) {
      return remaining > 0 ? `사진 추가 (${remaining})` : '가득 참'
    }
    if (!uploadProgress) return '업로드 중…'
    const phaseLabel = uploadProgress.phase === 'compress' ? '압축' : '업로드'
    return `${phaseLabel} ${uploadProgress.completed}/${uploadProgress.total}`
  })()

  return (
    <div onPaste={handlePaste}>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-800">폴라로이드 앨범</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            최대 {TRAVEL_ALBUM_MAX_PHOTOS}장 · 사진마다 한줄 메모
            <span className="ml-2 text-gray-400">
              {photos.length}/{TRAVEL_ALBUM_MAX_PHOTOS}
            </span>
            {isCompressing && (
              <span className="ml-2 text-rose-500">
                기존 사진 압축 중
                {compressProgress
                  ? ` ${compressProgress.completed}/${compressProgress.total}`
                  : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUploadFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isCompressing || remaining <= 0}
            className="px-3 py-2 rounded-lg bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 disabled:opacity-50"
          >
            {uploadButtonLabel}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center text-gray-500 py-16">앨범을 불러오는 중...</p>
      ) : (
        <div
          className="relative overflow-hidden rounded-3xl border border-stone-200 px-4 py-8 sm:px-8 sm:py-10"
          style={{
            background:
              'radial-gradient(circle at 20% 10%, #fff8f0 0%, transparent 40%), radial-gradient(circle at 80% 90%, #f3f7ef 0%, transparent 45%), linear-gradient(180deg, #faf7f2 0%, #f4f1ea 55%, #eef2ea 100%)',
          }}
        >
          <div className="pointer-events-none absolute inset-x-6 top-4 flex justify-between text-stone-300 text-lg">
            <span>✦</span>
            <span>☆</span>
            <span>✦</span>
          </div>

          <div className="mb-6 text-center">
            <h3
              className="inline-block px-3 py-1 text-2xl sm:text-3xl font-handwriting text-stone-800 tracking-wide"
              style={{
                background:
                  'linear-gradient(90deg, #fca5a5, #fcd34d, #86efac, #93c5fd, #c4b5fd)',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {albumLabel}
            </h3>
            {periodLabel ? (
              <p className="mt-1 text-sm font-semibold text-stone-600">{periodLabel}</p>
            ) : null}
            <p className="mt-1 text-xs text-stone-500">이미지 붙여넣기(Ctrl+V)도 가능해요</p>
          </div>

          {photos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white/50 py-16 text-center">
              <p className="text-stone-500 mb-3">아직 앨범 사진이 없어요</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600"
              >
                첫 사진 올리기
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10">
              {photos.map((photo, index) => {
                const rotation = getPolaroidRotation(photo.id, index)
                const isEditing = editingId === photo.id
                return (
                  <article
                    key={photo.id}
                    className="group relative w-[150px] sm:w-[170px] bg-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition-transform hover:z-10 hover:scale-[1.03]"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      padding: '10px 10px 14px',
                    }}
                  >
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-3 bg-white/70 border border-stone-200/80 shadow-sm rotate-[-2deg]" />
                    <div className="relative aspect-square overflow-hidden bg-stone-100">
                      <img
                        src={photo.imageUrl}
                        alt={photo.caption || `앨범 사진 ${index + 1}`}
                        className="w-full h-full object-cover"
                        width={170}
                        height={170}
                        loading={index < 4 ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                      {photo.isLocal && (
                        <div className="absolute inset-0 bg-white/50 flex items-center justify-center text-[10px] text-stone-600">
                          준비 중
                        </div>
                      )}
                    </div>
                    <div className="mt-2 min-h-[42px]">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingCaption}
                          maxLength={40}
                          onChange={(e) => setEditingCaption(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              saveCaption(photo.id)
                            }
                            if (e.key === 'Escape') {
                              setEditingId(null)
                            }
                          }}
                          className="w-full px-1 py-0.5 border border-rose-200 rounded text-xs font-handwriting focus:outline-none focus:ring-1 focus:ring-rose-300"
                          placeholder="한줄 메모..."
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditCaption(photo)}
                          disabled={photo.isLocal}
                          className="w-full text-left text-xs sm:text-sm font-handwriting text-stone-700 leading-snug min-h-[1.5rem]"
                          title="클릭해서 한줄 수정"
                        >
                          {photo.caption || (
                            <span className="text-stone-400">한줄을 적어보세요</span>
                          )}
                        </button>
                      )}
                    </div>
                    {!photo.isLocal && (
                      <div className="mt-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => saveCaption(photo.id)}
                            disabled={savingId === photo.id}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700"
                          >
                            저장
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditCaption(photo)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-stone-50 text-stone-600"
                          >
                            한줄
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(photo)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600"
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          <div className="pointer-events-none mt-8 h-4 rounded-b-2xl bg-gradient-to-r from-emerald-700/30 via-lime-600/25 to-emerald-800/30" />
        </div>
      )}
    </div>
  )
}
