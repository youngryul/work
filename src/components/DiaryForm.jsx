import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useAiTokenInfo } from '../hooks/useAiTokenInfo.js'
import { saveDiary, getDiaryByDate, updateDiaryCoverImage } from '../services/diaryService.js'
import { uploadImage } from '../services/imageService.js'
import { markDiaryReminderShown } from '../services/diaryReminderService.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import AiTokenBalanceBadge from './AiTokenBalanceBadge.jsx'
import TokenDepositRequestModal from './TokenDepositRequestModal.jsx'
import FourCutDispenserModal from './FourCutDispenserModal.jsx'
import { showToast, TOAST_TYPES } from './Toast.jsx'
import { DIARY_EMOTION_LABELS, getDiaryEmotionLabel } from '../constants/diaryEmotions.js'
import { AI_FOUR_CUT_TOKEN_COST } from '../constants/aiTokenSettings.js'
import {
  AI_FOUR_CUT_SCENE_COUNT,
  DIARY_FORM_MODES,
  DIARY_MODE,
  DIARY_MODE_LABELS,
  PHOTO_FOUR_CUT_MAX,
} from '../constants/diaryModes.js'

const EMOTION_LABELS = DIARY_EMOTION_LABELS

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
  const fileInputRef = useRef(null)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [isSavingWithoutImage, setIsSavingWithoutImage] = useState(false)
  const [diaryMode, setDiaryMode] = useState(DIARY_MODE.AI_FOUR_CUT)
  const [fourCutProgress, setFourCutProgress] = useState(null)
  const [showFourCutModal, setShowFourCutModal] = useState(false)
  const [liveSceneUrls, setLiveSceneUrls] = useState([])
  const [liveFourCutUrl, setLiveFourCutUrl] = useState(null)
  const [isCreatingAiFourCut, setIsCreatingAiFourCut] = useState(false)
  /** write: 글 작성 / media: 글·사진 출력 및 생성·첨부 */
  const [formStep, setFormStep] = useState('write')
  const [isUpdatingCover, setIsUpdatingCover] = useState(false)

  const { balance: tokenBalance, generationCost } = useAiTokenInfo(
    tokenRefreshDep ?? selectedDate,
  )

  const aiFourCutCost = AI_FOUR_CUT_TOKEN_COST
  const isPhotoFourCut = diaryMode === DIARY_MODE.PHOTO_FOUR_CUT
  const isAiFourCut = diaryMode === DIARY_MODE.AI_FOUR_CUT

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
        setDiaryEmotion(getDiaryEmotionLabel(diary.emotion) ?? null)
        const hasAiFourCut = Boolean(diary.fourCutUrl) || (diary.fourCutSceneUrls || []).length > 0
        setDiaryMode(
          !hasAiFourCut && diary.photoFourCutUrl
            ? DIARY_MODE.PHOTO_FOUR_CUT
            : DIARY_MODE.AI_FOUR_CUT,
        )
        setFormStep('write')
      } else {
        setContent('')
        setExistingDiary(null)
        setAttachedImages([])
        setDiaryEmotion(null)
        setDiaryMode(DIARY_MODE.AI_FOUR_CUT)
        setFormStep('write')
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

  /** 4컷 디스펜서 모달 열기 (AI 4컷 / 사진 4컷 공용) */
  const openFourCutBooth = (sceneUrls, stripUrl) => {
    setLiveSceneUrls(sceneUrls || [])
    setLiveFourCutUrl(stripUrl || null)
    setShowFourCutModal(true)
  }

  const runAfterDiarySaved = async (
    saved,
    { withImage = true, booth = null, closeAfter = true } = {},
  ) => {
    if (saved?.emotion) setDiaryEmotion(EMOTION_LABELS[saved.emotion] ?? saved.emotion)

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

  /** 텍스트만 저장 (첨부·4컷 데이터 유지) */
  const saveTextOnly = async () => {
    const preservedImages = attachedImages.length > 0
      ? attachedImages
      : (existingDiary?.attachedImages || [])
    return saveDiary(selectedDate, content, false, preservedImages, {
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

  /**
   * AI 4컷 / 사진 4컷 저장
   * @param {string} mode
   */
  const saveDiaryWithMode = async (mode) => {
    if (!content.trim()) {
      showToast('일기 내용을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    const isPhoto = mode === DIARY_MODE.PHOTO_FOUR_CUT
    const isAiFour = mode === DIARY_MODE.AI_FOUR_CUT

    if (isPhoto && attachedImages.length === 0) {
      showToast('사진 4컷 모드에서는 사진을 1장 이상 첨부해주세요.', TOAST_TYPES.ERROR)
      return
    }

    if (isAiFour && hasInsufficientTokensForAiFourCut) {
      openDepositModal()
      return
    }

    setDiaryMode(mode)
    setIsLoading(true)
    setError(null)

    if (isAiFour) {
      setIsCreatingAiFourCut(true)
      setLiveSceneUrls([])
      setLiveFourCutUrl(null)
      setFourCutProgress({ done: 0, total: AI_FOUR_CUT_SCENE_COUNT, phase: 'planning' })
      setShowFourCutModal(true)
    }

    try {
      // AI 4컷 저장 시에도 기존 사진 4컷 원본을 유지
      const imagesForSave = isPhoto ? attachedImages : (existingDiary?.attachedImages || [])
      const saved = await saveDiary(selectedDate, content, false, imagesForSave, {
        mode,
        skipImageGeneration: isPhoto,
        onFourCutProgress: isAiFour
          ? (info) => {
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
            }
          : undefined,
      })
      setExistingDiary(saved)
      if (isPhoto) {
        setAttachedImages(saved?.attachedImages || attachedImages)
      }
      await runAfterDiarySaved(saved, {
        booth: isPhoto
          ? { sceneUrls: saved?.attachedImages || attachedImages, stripUrl: saved?.photoFourCutUrl }
          : { sceneUrls: saved?.fourCutSceneUrls, stripUrl: saved?.fourCutUrl },
        closeAfter: false,
      })
    } catch (error) {
      console.error('일기 저장 실패:', error)
      const message = error.message || '일기 저장에 실패했습니다.'
      setError(message)
      if (isAiFour) {
        setShowFourCutModal(false)
      }
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    await saveDiaryWithMode(diaryMode)
  }

  const handleSaveAiFourCut = () => saveDiaryWithMode(DIARY_MODE.AI_FOUR_CUT)

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
   * 파일 업로드 핸들러
   */
  const handleFileUpload = async (e) => {
    if (!isPhotoFourCut) return

    const files = Array.from(e.target.files)
    if (files.length === 0) return

    for (const file of files) {
      if (attachedImages.length >= PHOTO_FOUR_CUT_MAX) {
        showToast(`사진은 최대 ${PHOTO_FOUR_CUT_MAX}장까지 첨부할 수 있습니다.`, TOAST_TYPES.ERROR)
        break
      }

      const fileId = `${Date.now()}-${Math.random().toString(36).substring(2)}`
      setUploadingImages(prev => ({ ...prev, [fileId]: true }))

      try {
        const imageUrl = await uploadImage(file, 'diaries')
        setAttachedImages(prev => {
          if (prev.length >= PHOTO_FOUR_CUT_MAX) return prev
          return [...prev, imageUrl]
        })
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

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * 클립보드에서 이미지 붙여넣기 (사진 4컷만)
   */
  const handlePaste = async (e) => {
    if (!isPhotoFourCut) return

    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        if (attachedImages.length >= PHOTO_FOUR_CUT_MAX) {
          showToast(`사진은 최대 ${PHOTO_FOUR_CUT_MAX}장까지 첨부할 수 있습니다.`, TOAST_TYPES.ERROR)
          return
        }

        const file = item.getAsFile()
        if (!file) continue

        const fileId = `${Date.now()}-${Math.random().toString(36).substring(2)}`
        setUploadingImages(prev => ({ ...prev, [fileId]: true }))

        try {
          const imageUrl = await uploadImage(file, 'diaries')
          setAttachedImages(prev => {
            if (prev.length >= PHOTO_FOUR_CUT_MAX) return prev
            return [...prev, imageUrl]
          })
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
    }
  }

  /**
   * 첨부 이미지 삭제
   */
  const handleRemoveImage = (index) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index))
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
  const photoFourCutUrl = existingDiary?.photoFourCutUrl || null
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
  const photoFourCutBoothAction = photoFourCutUrl
    ? { label: '사진 4컷 보기', onClick: () => openFourCutBooth(savedPhotos, photoFourCutUrl) }
    : null

  const aiFourCutCoverPicker = renderCoverPicker(
    'AI 4컷 대문 선택',
    fourCutScenes,
    [aiFourCutBoothAction].filter(Boolean),
  )
  const photoFourCutCoverPicker = photoFourCutUrl && renderCoverPicker(
    '사진 4컷 대문 선택',
    savedPhotos,
    [photoFourCutBoothAction].filter(Boolean),
  )

  const stepTabs = (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        onClick={() => setFormStep('write')}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors font-sans ${
          formStep === 'write'
            ? 'bg-green-500 text-white'
            : 'bg-green-50 text-green-800 hover:bg-green-100'
        }`}
      >
        1. 글 쓰기
      </button>
      <button
        type="button"
        onClick={() => {
          if (!content.trim()) {
            showToast('먼저 일기 글을 작성해 주세요.', TOAST_TYPES.ERROR)
            return
          }
          setFormStep('media')
        }}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors font-sans ${
          formStep === 'media'
            ? 'bg-green-500 text-white'
            : 'bg-green-50 text-green-800 hover:bg-green-100'
        }`}
      >
        2. 사진·이미지
      </button>
    </div>
  )

  const writeStepContent = (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 font-sans">
          {existingDiary ? '일기 수정' : '일기 작성'}
        </h1>
        {datePicker}
        {stepTabs}
        <p className="mt-3 text-sm text-gray-500 font-sans">
          글을 쓴 뒤 글만 저장하거나 AI 4컷을 만들 수 있습니다.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
            오늘의 일기
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="오늘 하루를 기록해보세요..."
            className="w-full h-72 p-4 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans resize-none"
          />
        </div>

        {aiFourCutCoverPicker}
        {photoFourCutCoverPicker}

        {error && formStep === 'write' && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-sans">{error}</p>
          </div>
        )}

        {hasInsufficientTokensForAiFourCut && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 font-sans">
            <p className="font-semibold">AI 4컷에 토큰이 부족합니다. (필요 {aiFourCutCost}개)</p>
            <button
              type="button"
              onClick={openDepositModal}
              className="mt-2 text-sm font-semibold text-amber-700 underline hover:text-amber-900"
            >
              토큰 충전 신청하기 →
            </button>
          </div>
        )}

        <p className="text-sm text-amber-800 font-sans">
          AI 4컷은 일기를 4장면으로 만들어 저장합니다. 1회 {aiFourCutCost}토큰이 소모됩니다.
        </p>

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
            disabled={isSavingWithoutImage || isCreatingAiFourCut || isLoading || !content.trim()}
            className="px-6 py-2 border-2 border-green-400 bg-green-50 text-green-800 rounded-lg hover:bg-green-100 transition-colors text-base font-medium shadow-md font-sans disabled:opacity-50"
          >
            {isSavingWithoutImage ? '저장 중...' : '글만 저장'}
          </button>
          <button
            type="button"
            onClick={handleSaveAiFourCut}
            disabled={
              isSavingWithoutImage
              || isCreatingAiFourCut
              || isLoading
              || !content.trim()
              || hasInsufficientTokensForAiFourCut
            }
            className="px-6 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-base font-medium shadow-md font-sans disabled:opacity-50"
          >
            {isCreatingAiFourCut
              ? 'AI 4컷 생성 중...'
              : hasAiFourCut
                ? `AI 4컷 다시 만들기 (${aiFourCutCost}토큰)`
                : `AI 4컷 저장 (${aiFourCutCost}토큰)`}
          </button>
        </div>
      </div>
    </>
  )

  const mediaStepContent = (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 font-sans">
          사진 · 이미지
        </h1>
        {datePicker}
        {stepTabs}

        <div className="mt-4 flex flex-wrap gap-2">
          {DIARY_FORM_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDiaryMode(mode)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors font-sans ${
                diaryMode === mode
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {DIARY_MODE_LABELS[mode]}
            </button>
          ))}
        </div>

        {isAiFourCut && (
          <p className="mt-2 text-sm text-amber-800 font-sans">
            생성 전 일기를 4줄로 요약한 뒤 시간 흐름이 보이게 만듭니다. 1회 {aiFourCutCost}토큰이 소모됩니다.
          </p>
        )}
        {isPhotoFourCut && (
          <p className="mt-2 text-sm text-green-800 font-sans">
            사진 최대 {PHOTO_FOUR_CUT_MAX}장을 첨부하면 4컷 스트립으로 저장됩니다. AI 4컷과 따로 보관됩니다. (AI 토큰 없음)
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" onPaste={handlePaste}>
        {/* AI 4컷: 4컷만 */}
        {isAiFourCut && (
          <div className="space-y-4">
            {isCreatingAiFourCut && !showFourCutModal && (
              <div className="rounded-lg border-2 border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 font-sans">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500" />
                  <span>
                    AI 4컷 생성 중
                    {fourCutProgress
                      ? ` (${fourCutProgress.done}/${fourCutProgress.total})`
                      : '...'}
                  </span>
                </div>
              </div>
            )}

            {hasAiFourCut ? (
              <div className="space-y-4">
                {aiFourCutCoverPicker}
                {existingDiary?.fourCutUrl && (
                  <div>
                    <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                      AI 4컷
                    </label>
                    <img
                      src={existingDiary.fourCutUrl}
                      alt="4컷 일기"
                      className="w-40 rounded-lg border-2 border-green-200 bg-white object-contain shadow"
                    />
                  </div>
                )}
                {diaryEmotion && (
                  <p className="text-sm text-gray-500 font-sans">
                    오늘의 감정: <span className="font-semibold text-green-600">{diaryEmotion}</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 font-sans">
                아직 생성된 AI 4컷이 없습니다. 아래 버튼으로 만들어 보세요.
              </p>
            )}
          </div>
        )}

        {/* 사진 4컷: 첨부 + 스트립만 */}
        {isPhotoFourCut && (
          <div className="space-y-4">
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                사진 첨부 ({attachedImages.length}/{PHOTO_FOUR_CUT_MAX})
              </label>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
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
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium cursor-pointer font-sans"
                  >
                    📷 사진 선택
                  </label>
                  <p className="text-xs text-gray-500 font-sans">
                    최대 {PHOTO_FOUR_CUT_MAX}장 · Ctrl+V로 붙여넣기
                  </p>
                </div>

                {Object.keys(uploadingImages).length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 font-sans">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                    <span>이미지 업로드 중...</span>
                  </div>
                )}
              </div>
            </div>

            {attachedImages.length > 0 && (
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                  첨부된 사진 ({attachedImages.length}개)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {attachedImages.map((imageUrl, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={imageUrl}
                        alt={`첨부 이미지 ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors text-xs font-bold opacity-0 group-hover:opacity-100"
                        title="삭제"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {photoFourCutUrl && (
              <div className="space-y-4">
                {photoFourCutCoverPicker}
                <div>
                  <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                    저장된 사진 4컷
                  </label>
                  <div className="flex flex-wrap items-start gap-3">
                    <img
                      src={photoFourCutUrl}
                      alt="사진 4컷"
                      className="w-40 rounded-lg border-2 border-green-200 bg-white object-contain shadow"
                    />
                    <button
                      type="button"
                      onClick={() => openFourCutBooth(savedPhotos, photoFourCutUrl)}
                      className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium font-sans hover:bg-stone-700"
                    >
                      4컷 보기 (애니메이션)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-sans">{error}</p>
          </div>
        )}

        {isAiFourCut && hasInsufficientTokensForAiFourCut && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 font-sans">
            <p className="font-semibold">AI 4컷에 토큰이 부족합니다. (필요 {aiFourCutCost}개)</p>
            <button
              type="button"
              onClick={openDepositModal}
              className="mt-2 text-sm font-semibold text-amber-700 underline hover:text-amber-900"
            >
              토큰 충전 신청하기 →
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-end pt-4 border-t-2 border-green-200">
          <button
            type="button"
            onClick={() => setFormStep('write')}
            className="px-6 py-2 border-2 border-green-200 rounded-lg text-gray-700 hover:bg-green-50 transition-colors text-base font-medium shadow-md font-sans"
          >
            ← 글 수정
          </button>
          <button
            type="button"
            onClick={() => onSave?.()}
            className="px-6 py-2 border-2 border-green-200 rounded-lg text-gray-700 hover:bg-green-50 transition-colors text-base font-medium shadow-md font-sans"
          >
            완료
          </button>
          <button
            type="submit"
            disabled={
              isLoading
              || isSavingWithoutImage
              || isCreatingAiFourCut
              || (isAiFourCut && hasInsufficientTokensForAiFourCut)
            }
            className="px-6 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-base font-medium shadow-md font-sans disabled:opacity-50"
          >
            {isCreatingAiFourCut
              ? 'AI 4컷 생성 중...'
              : isLoading
                ? '저장 중...'
                : isPhotoFourCut
                  ? '사진 4컷 저장'
                  : hasAiFourCut
                    ? `AI 4컷 다시 만들기 (${aiFourCutCost}토큰)`
                    : `AI 4컷 만들기 (${aiFourCutCost}토큰)`}
          </button>
        </div>
      </form>
    </>
  )

  const formContent = formStep === 'write' ? writeStepContent : mediaStepContent


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
