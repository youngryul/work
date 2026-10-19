import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useAiTokenInfo } from '../hooks/useAiTokenInfo.js'
import {
  saveDiary,
  saveDiaryAttachedImages,
  getDiaryByDate,
  updateDiaryCoverImage,
} from '../services/diaryService.js'
import { uploadImage } from '../services/imageService.js'
import { markDiaryReminderShown } from '../services/diaryReminderService.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import AiTokenBalanceBadge from './AiTokenBalanceBadge.jsx'
import TokenDepositRequestModal from './TokenDepositRequestModal.jsx'
import FourCutDispenserModal from './FourCutDispenserModal.jsx'
import { showToast, TOAST_TYPES } from './Toast.jsx'
import { getDiaryEmotionLabel } from '../constants/diaryEmotions.js'
import { AI_FOUR_CUT_TOKEN_COST } from '../constants/aiTokenSettings.js'
import {
  AI_FOUR_CUT_SCENE_COUNT,
  DIARY_MODE,
  PHOTO_ATTACH_MAX,
} from '../constants/diaryModes.js'

/**
 * 일기 작성/수정 폼 컴포넌트
 * @param {string} selectedDate - 선택된 날짜 (YYYY-MM-DD)
 * @param {Function} [onDateChange] - 날짜 변경 핸들러
 * @param {Function} onSave - 저장 완료 핸들러
 * @param {Function} onCancel - 취소 핸들러
 * @param {boolean} isModal - 모달 안에서 사용되는지 여부
 * @param {boolean} embedded - 상위 화면에서 토큰 배지를 표시하는 경우
 * @param {unknown} tokenRefreshDep - 토큰 배지 새로고침 트리거
 * @param {Function} [onOpenDepositModal] - 토큰 부족 시 상위에서 입금 모달 열기
 */
export default function DiaryForm({
  selectedDate,
  onDateChange,
  onSave,
  onCancel,
  isModal = false,
  embedded = false,
  tokenRefreshDep,
  onOpenDepositModal,
}) {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [existingDiary, setExistingDiary] = useState(null)
  const [diaryEmotion, setDiaryEmotion] = useState(null) // 저장 후 감정
  const [attachedImages, setAttachedImages] = useState([]) // 첨부된 이미지 URL 목록
  const [uploadingImages, setUploadingImages] = useState({}) // 업로드 중인 이미지 상태
  const [isSavingPhotos, setIsSavingPhotos] = useState(false) // 첨부 사진 자동 저장 중
  // 연속 업로드·삭제 시 최신 목록을 기준으로 저장하기 위한 ref
  const attachedImagesRef = useRef([])
  const fileInputRef = useRef(null)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [isSavingWithoutImage, setIsSavingWithoutImage] = useState(false)
  const [fourCutProgress, setFourCutProgress] = useState(null)
  const [showFourCutModal, setShowFourCutModal] = useState(false)
  const [liveSceneUrls, setLiveSceneUrls] = useState([])
  const [liveFourCutUrl, setLiveFourCutUrl] = useState(null)
  const [isCreatingAiFourCut, setIsCreatingAiFourCut] = useState(false)
  const [isUpdatingCover, setIsUpdatingCover] = useState(false)

  const { balance: tokenBalance, generationCost } = useAiTokenInfo(
    tokenRefreshDep ?? selectedDate,
  )

  const aiFourCutCost = AI_FOUR_CUT_TOKEN_COST

  // 기존 일기 로드
  useEffect(() => {
    if (!selectedDate) return
    setError(null)
    setLiveSceneUrls([])
    setLiveFourCutUrl(null)
    setShowFourCutModal(false)
    setFourCutProgress(null)
    loadExistingDiary()
  }, [selectedDate])

  const loadExistingDiary = async () => {
    try {
      const diary = await getDiaryByDate(selectedDate)
      if (diary) {
        setContent(diary.content)
        setExistingDiary(diary)
        setAttachedImages(diary.attachedImages || [])
        attachedImagesRef.current = diary.attachedImages || []
        setDiaryEmotion(getDiaryEmotionLabel(diary.emotion) ?? null)
      } else {
        setContent('')
        setExistingDiary(null)
        setAttachedImages([])
        attachedImagesRef.current = []
        setDiaryEmotion(null)
      }
    } catch (error) {
      console.error('일기 로드 실패:', error)
    }
  }

  const hasInsufficientTokensForAiFourCut =
    tokenBalance !== null && tokenBalance < aiFourCutCost

  const openDepositModal = () => {
    if (onOpenDepositModal) {
      onOpenDepositModal()
      return
    }
    setShowDepositModal(true)
  }

  const isTokenError = (message) =>
    typeof message === 'string' && (message.includes('토큰') || message.includes('token'))

  /** AI 4컷 디스펜서 모달 열기 */
  const openFourCutBooth = (sceneUrls, stripUrl) => {
    setLiveSceneUrls(sceneUrls || [])
    setLiveFourCutUrl(stripUrl || null)
    setShowFourCutModal(true)
  }

  const runAfterDiarySaved = async (
    saved,
    { withImage = true, booth = null, closeAfter = true } = {},
  ) => {
    if (saved?.emotion) setDiaryEmotion(getDiaryEmotionLabel(saved.emotion) ?? null)

    const consumed = saved?.tokensConsumedCount || (saved?.tokensConsumed ? 1 : 0)
    const tokensUsed = saved?.tokensUsed > 0
      ? saved.tokensUsed
      : (consumed > 0 ? generationCost * consumed : 0)
    const saveMsg = tokensUsed > 0
      ? `일기가 저장되었습니다. (${tokensUsed}토큰 사용)`
      : withImage
        ? '일기가 저장되었습니다.'
        : '일기가 저장되었습니다. (이미지 없음)'

    showToast(saveMsg, TOAST_TYPES.SUCCESS)
    setShowDepositModal(false)

    if (booth) {
      openFourCutBooth(booth.sceneUrls, booth.stripUrl)
    }

    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayDateString = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

    if (selectedDate === yesterdayDateString) {
      try {
        await markDiaryReminderShown(user?.id)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refreshNotifications'))
        }, 500)
      } catch (err) {
        console.error('리마인더 기록 실패:', err)
      }
    }

    if (closeAfter) {
      onSave?.()
    }
  }

  /** 텍스트만 저장 (첨부 사진·4컷 데이터 유지) */
  const saveTextOnly = async () => {
    return saveDiary(selectedDate, content, false, attachedImagesRef.current, {
      skipImageGeneration: true,
      mode: DIARY_MODE.NORMAL,
    })
  }

  /** 글만 저장하고 종료 */
  const handleSaveWithoutImage = async () => {
    if (!content.trim()) {
      showToast('일기 내용을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    setIsSavingWithoutImage(true)
    setError(null)

    try {
      const saved = await saveTextOnly()
      setExistingDiary(saved)
      await runAfterDiarySaved(saved, { withImage: false, closeAfter: true })
    } catch (err) {
      console.error('일기 저장 실패:', err)
      const message = err.message || '일기 저장에 실패했습니다.'
      setError(message)
      showToast(message, TOAST_TYPES.ERROR)
    } finally {
      setIsSavingWithoutImage(false)
    }
  }

  /** AI 4컷 생성 후 저장 (첨부 사진은 그대로 유지) */
  const saveAiFourCut = async () => {
    if (!content.trim()) {
      showToast('일기 내용을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    if (hasInsufficientTokensForAiFourCut) {
      openDepositModal()
      return
    }

    setIsLoading(true)
    setError(null)
    setIsCreatingAiFourCut(true)
    setLiveSceneUrls([])
    setLiveFourCutUrl(null)
    setFourCutProgress({ done: 0, total: AI_FOUR_CUT_SCENE_COUNT, phase: 'planning' })
    setShowFourCutModal(true)

    try {
      const saved = await saveDiary(selectedDate, content, false, attachedImagesRef.current, {
        mode: DIARY_MODE.AI_FOUR_CUT,
        onFourCutProgress: (info) => {
          setFourCutProgress({
            done: info.done,
            total: info.total,
            phase: info.phase,
          })
          if (info.imageUrl) {
            setLiveSceneUrls((prev) => (
              prev.includes(info.imageUrl) ? prev : [...prev, info.imageUrl]
            ))
          }
          if (info.fourCutUrl) {
            setLiveFourCutUrl(info.fourCutUrl)
          }
        },
      })
      setExistingDiary(saved)
      await runAfterDiarySaved(saved, {
        booth: { sceneUrls: saved?.fourCutSceneUrls, stripUrl: saved?.fourCutUrl },
        closeAfter: false,
      })
    } catch (error) {
      console.error('일기 저장 실패:', error)
      const message = error.message || '일기 저장에 실패했습니다.'
      setError(message)
      setShowFourCutModal(false)
      if (isTokenError(message)) {
        openDepositModal()
      } else {
        showToast(message, TOAST_TYPES.ERROR)
      }
    } finally {
      setIsLoading(false)
      setIsCreatingAiFourCut(false)
      setFourCutProgress(null)
    }
  }

  const handleSaveAiFourCut = () => saveAiFourCut()

  const handleSelectCover = async (imageUrl) => {
    if (!selectedDate || !imageUrl || isUpdatingCover) return
    if (existingDiary?.coverImageUrl === imageUrl) return

    setIsUpdatingCover(true)
    try {
      const updated = await updateDiaryCoverImage(selectedDate, imageUrl)
      setExistingDiary(updated)
      showToast('달력 대문 사진을 변경했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('대문 이미지 변경 실패:', error)
      showToast(error.message || '대문 이미지 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsUpdatingCover(false)
    }
  }

  /**
   * 첨부 사진 목록을 바로 DB에 저장 (사진 추가·삭제 시 자동 저장)
   * @param {string[]} nextImages
   */
  const persistAttachedImages = async (nextImages) => {
    if (!content.trim()) {
      showToast('먼저 일기 글을 작성해 주세요.', TOAST_TYPES.ERROR)
      return
    }

    const previousImages = attachedImagesRef.current
    attachedImagesRef.current = nextImages
    setAttachedImages(nextImages)
    setIsSavingPhotos(true)

    try {
      const saved = await saveDiaryAttachedImages(selectedDate, content, nextImages)
      setExistingDiary(saved)
      showToast('사진이 저장되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('첨부 사진 저장 실패:', error)
      attachedImagesRef.current = previousImages
      setAttachedImages(previousImages)
      showToast(error.message || '사진 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSavingPhotos(false)
    }
  }

  /**
   * 이미지 파일들을 업로드한 뒤 첨부 목록에 추가하고 자동 저장
   * @param {File[]} files
   */
  const addPhotoFiles = async (files) => {
    if (files.length === 0) return

    const room = PHOTO_ATTACH_MAX - attachedImagesRef.current.length
    if (room <= 0) {
      showToast(`사진은 최대 ${PHOTO_ATTACH_MAX}장까지 첨부할 수 있습니다.`, TOAST_TYPES.ERROR)
      return
    }
    if (files.length > room) {
      showToast(`사진은 최대 ${PHOTO_ATTACH_MAX}장까지 첨부할 수 있어 ${room}장만 추가합니다.`, TOAST_TYPES.ERROR)
    }

    const uploadedUrls = []
    for (const file of files.slice(0, room)) {
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(2)}`
      setUploadingImages(prev => ({ ...prev, [fileId]: true }))

      try {
        uploadedUrls.push(await uploadImage(file, 'diaries'))
      } catch (error) {
        console.error('이미지 업로드 실패:', error)
        showToast(`이미지 업로드 실패: ${error.message || '알 수 없는 오류'}`, TOAST_TYPES.ERROR)
      } finally {
        setUploadingImages(prev => {
          const newState = { ...prev }
          delete newState[fileId]
          return newState
        })
      }
    }

    if (uploadedUrls.length > 0) {
      await persistAttachedImages(
        [...attachedImagesRef.current, ...uploadedUrls].slice(0, PHOTO_ATTACH_MAX),
      )
    }
  }

  /**
   * 파일 선택 핸들러
   */
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    await addPhotoFiles(files)
  }

  /**
   * 일기 칸에 이미지를 붙여넣으면 사진으로 첨부 (텍스트 붙여넣기는 그대로)
   */
  const handlePaste = async (e) => {
    const files = Array.from(e.clipboardData?.items || [])
      .filter((item) => item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean)
    if (files.length === 0) return

    e.preventDefault()
    await addPhotoFiles(files)
  }

  /**
   * 첨부 사진 삭제 (자동 저장)
   */
  const handleRemoveImage = async (index) => {
    await persistAttachedImages(attachedImagesRef.current.filter((_, i) => i !== index))
  }

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString + 'T00:00:00'), 'yyyy년 MM월 dd일 (EEE)', { locale: ko })
    } catch {
      return dateString
    }
  }

  const handleDateInputChange = (e) => {
    const nextDate = e.target.value
    if (!nextDate || !onDateChange) return
    onDateChange(nextDate)
  }

  const datePicker = (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="date"
        value={selectedDate || ''}
        onChange={handleDateInputChange}
        disabled={!onDateChange}
        className="px-3 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400 font-sans text-base disabled:bg-gray-50 disabled:text-gray-500"
        aria-label="일기 날짜 선택"
      />
      <p className="text-base text-gray-600 font-sans">
        {selectedDate && formatDate(selectedDate)}
      </p>
    </div>
  )

  const fourCutScenes = existingDiary?.fourCutSceneUrls || []
  const savedPhotos = existingDiary?.attachedImages || []
  const hasAiFourCut = Boolean(existingDiary?.fourCutUrl) || fourCutScenes.length > 0
  const currentCoverUrl =
    existingDiary?.coverImageUrl
    || fourCutScenes[0]
    || savedPhotos[0]
    || null

  /**
   * 대문 사진 선택 그리드
   * @param {string} title
   * @param {string[]} urls
   * @param {Array<{ label: string, onClick: () => void }>} [actions]
   */
  const renderCoverPicker = (title, urls, actions = []) => urls.length > 0 && (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-gray-600 font-sans">
          {title} ({urls.length}장)
        </h4>
        <div className="flex gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs text-gray-500 font-sans">
        달력에 보일 대표 사진을 골라 주세요.
      </p>
      <div className="grid grid-cols-4 gap-2">
        {urls.map((url, index) => {
          const isSelected = currentCoverUrl === url
          return (
            <button
              key={`${url}-${index}`}
              type="button"
              disabled={isUpdatingCover}
              onClick={() => handleSelectCover(url)}
              className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-green-500 ring-2 ring-green-300'
                  : 'border-gray-200 hover:border-green-300'
              } disabled:opacity-60`}
            >
              <img
                src={url}
                alt={`${index + 1}번째 사진`}
                className="h-24 w-full object-cover"
              />
              {isSelected && (
                <span className="absolute bottom-1 left-1 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  대문
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )

  const aiFourCutBoothAction = existingDiary?.fourCutUrl
    ? { label: 'AI 4컷 보기', onClick: () => openFourCutBooth(fourCutScenes, existingDiary.fourCutUrl) }
    : null

  const aiFourCutCoverPicker = renderCoverPicker(
    'AI 4컷 장면',
    fourCutScenes,
    [aiFourCutBoothAction].filter(Boolean),
  )

  const isBusy = isLoading || isSavingWithoutImage || isCreatingAiFourCut
  const isUploadingPhotos = Object.keys(uploadingImages).length > 0

  /** 사진 첨부 영역: 첨부하면 자동 저장, 클릭해서 대표 사진 선택 */
  const photoSection = (
    <section className="rounded-xl border-2 border-green-100 bg-white/70 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-700 font-sans">
          📷 사진 <span className="text-xs font-normal text-gray-500">{attachedImages.length}/{PHOTO_ATTACH_MAX}장</span>
        </h3>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
          id="diary-image-upload"
        />
        <label
          htmlFor="diary-image-upload"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium font-sans transition-colors ${
            content.trim()
              ? 'bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'
          }`}
        >
          사진 추가
        </label>
      </div>
      <p className="text-xs text-gray-500 font-sans">
        {content.trim()
          ? '첨부하면 바로 저장됩니다. 일기 칸에 Ctrl+V로 붙여넣어도 돼요. 사진을 누르면 대표 사진으로 지정됩니다.'
          : '일기 글을 먼저 쓰면 사진을 첨부할 수 있어요.'}
      </p>
      {(isUploadingPhotos || isSavingPhotos) && (
        <div className="flex items-center gap-2 text-sm text-gray-600 font-sans">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
          <span>{isUploadingPhotos ? '사진 업로드 중...' : '저장 중...'}</span>
        </div>
      )}
      {attachedImages.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {attachedImages.map((imageUrl, index) => {
            const isCover = currentCoverUrl === imageUrl
            return (
              <div key={`${imageUrl}-${index}`} className="relative group">
                <button
                  type="button"
                  disabled={isUpdatingCover || isSavingPhotos}
                  onClick={() => handleSelectCover(imageUrl)}
                  className={`block w-full overflow-hidden rounded-lg border-2 transition-all ${
                    isCover
                      ? 'border-green-500 ring-2 ring-green-300'
                      : 'border-gray-200 hover:border-green-300'
                  } disabled:opacity-60`}
                  title="대표 사진으로 지정"
                >
                  <img
                    src={imageUrl}
                    alt={`첨부 사진 ${index + 1}`}
                    className="w-full h-24 object-cover"
                  />
                </button>
                {isCover && (
                  <span className="absolute bottom-1 left-1 rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    대표
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  disabled={isSavingPhotos}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors text-xs font-bold opacity-100 sm:opacity-0 sm:group-hover:opacity-100 disabled:opacity-50"
                  title="삭제"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )

  /** AI 4컷 영역: 생성 버튼·진행 상태·장면(대표 선택) */
  const aiFourCutSection = (
    <section className="rounded-xl border-2 border-amber-100 bg-white/70 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-700 font-sans">🎨 AI 4컷</h3>
        <button
          type="button"
          onClick={handleSaveAiFourCut}
          disabled={isBusy || !content.trim() || hasInsufficientTokensForAiFourCut}
          className="px-3 py-1.5 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-sm font-medium font-sans disabled:opacity-50"
        >
          {isCreatingAiFourCut
            ? '생성 중...'
            : hasAiFourCut
              ? `다시 만들기 (${aiFourCutCost}토큰)`
              : `만들기 (${aiFourCutCost}토큰)`}
        </button>
      </div>
      <p className="text-xs text-amber-800 font-sans">
        일기를 4장면으로 요약해 그림으로 만들고 일기와 함께 저장합니다.
      </p>

      {isCreatingAiFourCut && !showFourCutModal && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900 font-sans">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500" />
          <span>
            AI 4컷 생성 중
            {fourCutProgress ? ` (${fourCutProgress.done}/${fourCutProgress.total})` : '...'}
          </span>
        </div>
      )}

      {hasInsufficientTokensForAiFourCut && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 font-sans">
          <p className="font-semibold">토큰이 부족합니다. (필요 {aiFourCutCost}개)</p>
          <button
            type="button"
            onClick={openDepositModal}
            className="mt-1 text-sm font-semibold text-amber-700 underline hover:text-amber-900"
          >
            토큰 충전 신청하기 →
          </button>
        </div>
      )}

      {aiFourCutCoverPicker}

      {diaryEmotion && (
        <p className="text-sm text-gray-500 font-sans">
          오늘의 감정: <span className="font-semibold text-green-600">{diaryEmotion}</span>
        </p>
      )}
    </section>
  )

  const formContent = (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 font-sans">
          {existingDiary ? '일기 수정' : '일기 작성'}
        </h1>
        {datePicker}
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
            오늘의 일기
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={handlePaste}
            placeholder="오늘 하루를 기록해보세요..."
            className="w-full h-72 p-4 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans resize-none"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {photoSection}
          {aiFourCutSection}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-sans">{error}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-end pt-4 border-t-2 border-green-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border-2 border-green-200 rounded-lg text-gray-700 hover:bg-green-50 transition-colors text-base font-medium shadow-md font-sans"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSaveWithoutImage}
            disabled={isBusy || isSavingPhotos || isUploadingPhotos || !content.trim()}
            className="px-6 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-base font-medium shadow-md font-sans disabled:opacity-50"
          >
            {isSavingWithoutImage ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </>
  )


  const depositModal = !onOpenDepositModal && (
    <TokenDepositRequestModal
      isOpen={showDepositModal}
      onClose={() => setShowDepositModal(false)}
      tokenBalance={tokenBalance}
      generationCost={generationCost}
    />
  )

  const fourCutModal = (
    <FourCutDispenserModal
      isOpen={showFourCutModal}
      sceneUrls={
        liveSceneUrls.length > 0
          ? liveSceneUrls
          : (existingDiary?.fourCutSceneUrls || [])
      }
      fourCutUrl={liveFourCutUrl || existingDiary?.fourCutUrl || null}
      isGenerating={isCreatingAiFourCut}
      progress={fourCutProgress}
      dateLabel={selectedDate || ''}
      onClose={() => {
        if (isCreatingAiFourCut) return
        setShowFourCutModal(false)
      }}
    />
  )

  // 모달 안에서 사용되는 경우
  if (isModal) {
    return (
      <>
        {formContent}
        {depositModal}
        {fourCutModal}
      </>
    )
  }

  // 일반 화면에서 사용되는 경우
  if (embedded) {
    return (
      <>
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border-2 border-green-200 p-6">
          {formContent}
        </div>
        {depositModal}
        {fourCutModal}
      </>
    )
  }

  return (
    <div className="relative max-w-4xl mx-auto p-6 pt-14">
      <AiTokenBalanceBadge
        refreshDep={tokenRefreshDep ?? selectedDate}
        onBalanceClick={openDepositModal}
      />
      <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border-2 border-green-200 p-6">
        {formContent}
      </div>
      {depositModal}
      {fourCutModal}
    </div>
  )
}
