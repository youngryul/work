import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useAiTokenInfo } from '../hooks/useAiTokenInfo.js'
import { saveDiary, getDiaryByDate } from '../services/diaryService.js'
import { uploadImage } from '../services/imageService.js'
import { markDiaryReminderShown } from '../services/diaryReminderService.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import AiTokenBalanceBadge from './AiTokenBalanceBadge.jsx'
import AiTokenGenerationCostNote from './AiTokenGenerationCostNote.jsx'
import TokenDepositRequestModal from './TokenDepositRequestModal.jsx'
import DiaryShareButton from './DiaryShareButton.jsx'
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
 * @param {Function} onSave - 저장 완료 핸들러
 * @param {Function} onCancel - 취소 핸들러
 * @param {boolean} isModal - 모달 안에서 사용되는지 여부
 * @param {boolean} embedded - 상위 화면에서 토큰 배지를 표시하는 경우
 * @param {unknown} tokenRefreshDep - 토큰 배지 새로고침 트리거
 * @param {Function} [onOpenDepositModal] - 토큰 부족 시 상위에서 입금 모달 열기
 */
export default function DiaryForm({
  selectedDate,
  onSave,
  onCancel,
  isModal = false,
  embedded = false,
  tokenRefreshDep,
  onOpenDepositModal,
}) {
  const { user, isAdmin } = useAuth()
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [error, setError] = useState(null)
  const [existingDiary, setExistingDiary] = useState(null)
  const [imageLoadError, setImageLoadError] = useState(false) // 이미지 로드 실패 상태
  const [diaryEmotion, setDiaryEmotion] = useState(null) // 저장/재생성 후 감정
  const [showPrompt, setShowPrompt] = useState(false) // 프롬프트 표시 여부
  const [attachedImages, setAttachedImages] = useState([]) // 첨부된 이미지 URL 목록
  const [uploadingImages, setUploadingImages] = useState({}) // 업로드 중인 이미지 상태
  const fileInputRef = useRef(null)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [isSavingWithoutImage, setIsSavingWithoutImage] = useState(false)
  const [diaryMode, setDiaryMode] = useState(DIARY_MODE.NORMAL)
  const [fourCutProgress, setFourCutProgress] = useState(null)
  const [showFourCutModal, setShowFourCutModal] = useState(false)
  const [liveSceneUrls, setLiveSceneUrls] = useState([])
  const [liveFourCutUrl, setLiveFourCutUrl] = useState(null)
  const [isCreatingAiFourCut, setIsCreatingAiFourCut] = useState(false)
  /** write: 글 작성 / media: 글·사진 출력 및 생성·첨부 */
  const [formStep, setFormStep] = useState('write')

  const { balance: tokenBalance, generationCost } = useAiTokenInfo(
    tokenRefreshDep ?? selectedDate,
  )

  const aiFourCutCost = AI_FOUR_CUT_TOKEN_COST
  const isPhotoFourCut = diaryMode === DIARY_MODE.PHOTO_FOUR_CUT
  const isAiFourCut = diaryMode === DIARY_MODE.AI_FOUR_CUT
  const isAiOneCut = diaryMode === DIARY_MODE.NORMAL

  // 기존 일기 로드
  useEffect(() => {
    if (selectedDate) {
      loadExistingDiary()
    }
  }, [selectedDate])

  const loadExistingDiary = async () => {
    try {
      const diary = await getDiaryByDate(selectedDate)
      if (diary) {
        setContent(diary.content)
        setExistingDiary(diary)
        setImageLoadError(false)
        setAttachedImages(diary.attachedImages || [])
        setDiaryEmotion(getDiaryEmotionLabel(diary.emotion) ?? null)
        if (diary.fourCutUrl && (diary.attachedImages || []).length > 0) {
          setDiaryMode(DIARY_MODE.PHOTO_FOUR_CUT)
        } else if (diary.fourCutUrl || (diary.fourCutSceneUrls || []).length > 0) {
          setDiaryMode(DIARY_MODE.AI_FOUR_CUT)
        } else {
          setDiaryMode(DIARY_MODE.NORMAL)
        }
        const hasMedia = Boolean(
          diary.imageUrl
          || diary.fourCutUrl
          || (diary.fourCutSceneUrls || []).length > 0
          || (diary.attachedImages || []).length > 0,
        )
        setFormStep(hasMedia ? 'media' : 'write')
      } else {
        setContent('')
        setExistingDiary(null)
        setImageLoadError(false)
        setAttachedImages([])
        setDiaryEmotion(null)
        setDiaryMode(DIARY_MODE.NORMAL)
        setFormStep('write')
      }
    } catch (error) {
      console.error('일기 로드 실패:', error)
    }
  }

  const hasInsufficientTokens =
    tokenBalance !== null && tokenBalance < generationCost
  const hasInsufficientTokensForAiFourCut =
    tokenBalance !== null && tokenBalance < aiFourCutCost
  // 미디어 단계 AI 1컷은 생성/재생성 모두 토큰 필요
  const needsNewImageOnSave = isAiOneCut
  const needsTokensForAiFourCutSubmit = isAiFourCut

  const openDepositModal = () => {
    if (onOpenDepositModal) {
      onOpenDepositModal()
      return
    }
    setShowDepositModal(true)
  }

  const isTokenError = (message) =>
    typeof message === 'string' && (message.includes('토큰') || message.includes('token'))

  const runAfterDiarySaved = async (
    saved,
    { withImage = true, openBooth = false, closeAfter = true } = {},
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

    if (openBooth || saved?.fourCutUrl) {
      setLiveSceneUrls(saved?.fourCutSceneUrls || [])
      setLiveFourCutUrl(saved?.fourCutUrl || null)
      setShowFourCutModal(true)
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

  /** 글 저장 후 이미지 단계로 이동 */
  const handleSaveTextAndGoMedia = async () => {
    if (!content.trim()) {
      showToast('일기 내용을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    setIsSavingWithoutImage(true)
    setError(null)

    try {
      const saved = await saveTextOnly()
      setExistingDiary(saved)
      showToast('글이 저장되었습니다. 사진을 만들거나 첨부해 보세요.', TOAST_TYPES.SUCCESS)
      setFormStep('media')
    } catch (err) {
      console.error('일기 저장 실패:', err)
      const message = err.message || '일기 저장에 실패했습니다.'
      setError(message)
      showToast(message, TOAST_TYPES.ERROR)
    } finally {
      setIsSavingWithoutImage(false)
    }
  }

  // 저장 (AI 1컷 / AI 4컷 / 사진 4컷)
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!content.trim()) {
      showToast('일기 내용을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    if (isPhotoFourCut && attachedImages.length === 0) {
      showToast('사진 4컷 모드에서는 사진을 1장 이상 첨부해주세요.', TOAST_TYPES.ERROR)
      return
    }

    if (needsNewImageOnSave && hasInsufficientTokens) {
      openDepositModal()
      return
    }

    if (needsTokensForAiFourCutSubmit && hasInsufficientTokensForAiFourCut) {
      openDepositModal()
      return
    }

    setIsLoading(true)
    setIsGeneratingImage(isAiOneCut)
    setError(null)

    if (isAiFourCut) {
      setIsCreatingAiFourCut(true)
      setLiveSceneUrls([])
      setLiveFourCutUrl(null)
      setFourCutProgress({ done: 0, total: AI_FOUR_CUT_SCENE_COUNT, phase: 'planning' })
      setShowFourCutModal(true)
    }

    try {
      const imagesForSave = isPhotoFourCut ? attachedImages : []
      // 미디어 단계의 AI 1컷은 생성/재생성 버튼이므로 기존 이미지가 있어도 다시 생성
      const regenerateOneCut = isAiOneCut && Boolean(existingDiary?.imageUrl)
      const saved = await saveDiary(selectedDate, content, regenerateOneCut, imagesForSave, {
        mode: diaryMode,
        skipImageGeneration: isPhotoFourCut,
        onFourCutProgress: isAiFourCut
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
      if (isPhotoFourCut) {
        setAttachedImages(saved?.attachedImages || attachedImages)
      }
      if (saved?.fourCutSceneUrls?.length) {
        setLiveSceneUrls(saved.fourCutSceneUrls)
      }
      if (saved?.fourCutUrl) {
        setLiveFourCutUrl(saved.fourCutUrl)
      }
      // 이미지 생성 후 결과 확인을 위해 폼은 닫지 않음
      await runAfterDiarySaved(saved, {
        openBooth: isAiFourCut || isPhotoFourCut,
        closeAfter: false,
      })
    } catch (error) {
      console.error('일기 저장 실패:', error)
      const message = error.message || '일기 저장에 실패했습니다.'
      setError(message)
      if (isAiFourCut) {
        setShowFourCutModal(false)
      }
      if (isTokenError(message)) {
        openDepositModal()
      } else {
        showToast(message, TOAST_TYPES.ERROR)
      }
    } finally {
      setIsLoading(false)
      setIsGeneratingImage(false)
      setIsCreatingAiFourCut(false)
      setFourCutProgress(null)
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

  // 이미지 재생성
  const handleRegenerateImage = async () => {
    if (!content.trim()) {
      showToast('일기 내용을 먼저 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    if (hasInsufficientTokens) {
      openDepositModal()
      return
    }

    setIsGeneratingImage(true)
    setError(null)

    try {
      // 재생성된 일기 데이터를 받아옴
      const updatedDiary = await saveDiary(selectedDate, content, true, [], {
        mode: DIARY_MODE.NORMAL,
      })
      
      // 반환된 데이터로 즉시 상태 업데이트
      if (updatedDiary) {
        setExistingDiary({
          ...updatedDiary,
          // 브라우저 캐시 방지를 위해 이미지 URL에 타임스탬프 추가
          imageUrl: updatedDiary.imageUrl ? `${updatedDiary.imageUrl}?t=${Date.now()}` : null
        })
        setImageLoadError(false) // 이미지 로드 상태 초기화
        setShowPrompt(false) // 프롬프트 숨기기 (새 이미지 생성 시)
        if (updatedDiary.emotion) setDiaryEmotion(EMOTION_LABELS[updatedDiary.emotion] ?? updatedDiary.emotion)
      }
      
      // 데이터베이스에서 최신 데이터 다시 로드
      await loadExistingDiary()
      
      // 이미지가 성공적으로 생성되었는지 확인
      if (updatedDiary?.imageUrl) {
        const costMsg = updatedDiary.tokensConsumed
          ? ` (${generationCost}토큰 사용, 잔여 ${updatedDiary.remainingBalance ?? tokenBalance}개)`
          : ''
        showToast(`이미지가 재생성되었습니다.${costMsg}`, TOAST_TYPES.SUCCESS)
      } else {
        showToast('이미지 생성에 실패했습니다. 일기는 저장되었습니다.', TOAST_TYPES.ERROR)
      }
    } catch (error) {
      console.error('이미지 재생성 실패:', error)
      const errorMessage = error.message || '이미지 재생성에 실패했습니다.'
      setError(errorMessage)
      
      // 사용자 친화적인 에러 메시지 표시
      if (isTokenError(errorMessage)) {
        openDepositModal()
      } else if (errorMessage.includes('결제 한도') || errorMessage.includes('크레딧') || errorMessage.includes('billing')) {
        showToast(`⚠️ ${errorMessage}\n일기는 저장되었지만 이미지는 생성되지 않았습니다.`, TOAST_TYPES.ERROR)
      } else {
        showToast(`이미지 재생성 실패: ${errorMessage}`, TOAST_TYPES.ERROR)
      }
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const formatDate = (dateString) => {
    try {
      return format(new Date(dateString + 'T00:00:00'), 'yyyy년 MM월 dd일 (EEE)', { locale: ko })
    } catch {
      return dateString
    }
  }

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
        <p className="text-base text-gray-600 font-sans">
          {selectedDate && formatDate(selectedDate)}
        </p>
        {stepTabs}
        <p className="mt-3 text-sm text-gray-500 font-sans">
          먼저 오늘의 글을 쓰고, 다음 단계에서 사진을 생성하거나 첨부합니다.
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

        {error && formStep === 'write' && (
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
            disabled={isSavingWithoutImage || !content.trim()}
            className="px-6 py-2 border-2 border-green-400 bg-green-50 text-green-800 rounded-lg hover:bg-green-100 transition-colors text-base font-medium shadow-md font-sans disabled:opacity-50"
          >
            {isSavingWithoutImage ? '저장 중...' : '글만 저장'}
          </button>
          <button
            type="button"
            onClick={handleSaveTextAndGoMedia}
            disabled={isSavingWithoutImage || !content.trim()}
            className="px-6 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-base font-medium shadow-md font-sans disabled:opacity-50"
          >
            {isSavingWithoutImage ? '저장 중...' : '다음: 사진·이미지 →'}
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
        <p className="text-base text-gray-600 font-sans">
          {selectedDate && formatDate(selectedDate)}
        </p>
        {stepTabs}

        <div className="mt-4 flex flex-wrap gap-2">
          {DIARY_FORM_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setDiaryMode(mode)
                if (mode !== DIARY_MODE.PHOTO_FOUR_CUT) setAttachedImages([])
              }}
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

        {isAiOneCut && (
          <AiTokenGenerationCostNote cost={generationCost} className="mt-2" />
        )}
        {isAiFourCut && (
          <p className="mt-2 text-sm text-amber-800 font-sans">
            생성 전 일기를 4줄로 요약한 뒤 시간 흐름이 보이게 만듭니다. 1회 {aiFourCutCost}토큰이 소모됩니다.
          </p>
        )}
        {isPhotoFourCut && (
          <p className="mt-2 text-sm text-green-800 font-sans">
            사진 최대 {PHOTO_FOUR_CUT_MAX}장을 첨부하면 4컷 스트립으로 저장됩니다. (AI 토큰 없음)
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" onPaste={handlePaste}>
        {/* AI 1컷: 한 장만 */}
        {isAiOneCut && (
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              AI 1컷 이미지
            </label>
            {isGeneratingImage ? (
              <div className="w-full max-w-md h-64 bg-gray-100 rounded-lg border-2 border-green-200 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600 font-sans">이미지 생성 중...</p>
                </div>
              </div>
            ) : existingDiary?.imageUrl && !imageLoadError ? (
              <div>
                <img
                  key={existingDiary.imageUrl}
                  src={existingDiary.imageUrl}
                  alt="일기 이미지"
                  className="w-full max-w-md rounded-lg border-2 border-green-200"
                  onError={() => {
                    console.error('이미지 로드 실패:', existingDiary.imageUrl)
                    setImageLoadError(true)
                  }}
                />
                {diaryEmotion && (
                  <p className="mt-2 text-sm text-gray-500 font-sans">
                    오늘의 감정: <span className="font-semibold text-green-600">{diaryEmotion}</span>
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  <DiaryShareButton
                    imageUrl={existingDiary.imageUrl}
                    dateString={selectedDate}
                    emotionLabel={diaryEmotion || undefined}
                  />
                  <button
                    type="button"
                    onClick={handleRegenerateImage}
                    disabled={isGeneratingImage || hasInsufficientTokens}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium font-sans disabled:opacity-50"
                  >
                    {isGeneratingImage
                      ? '재생성 중...'
                      : `🔄 이미지 재생성 (${generationCost}토큰)`}
                  </button>
                  {isAdmin && existingDiary?.imagePrompt && (
                    <button
                      type="button"
                      onClick={() => setShowPrompt(!showPrompt)}
                      className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium font-sans"
                    >
                      {showPrompt ? '📝 프롬프트 숨기기' : '📝 프롬프트 보기'}
                    </button>
                  )}
                </div>
                {isAdmin && showPrompt && existingDiary?.imagePrompt && (
                  <div className="mt-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 font-sans">생성된 프롬프트:</h4>
                    <p className="text-xs text-gray-600 font-mono whitespace-pre-wrap break-words font-sans">
                      {existingDiary.imagePrompt}
                    </p>
                  </div>
                )}
              </div>
            ) : existingDiary?.imageUrl && imageLoadError ? (
              <div className="w-full max-w-md h-64 bg-gray-100 rounded-lg border-2 border-green-200 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-gray-600 font-sans mb-2">⚠️ 이미지를 불러올 수 없습니다</p>
                  <p className="text-xs text-gray-500 font-sans">이미지가 만료되었거나 삭제되었을 수 있습니다</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 font-sans">
                아직 생성된 1컷 이미지가 없습니다. 아래 버튼으로 만들어 보세요.
              </p>
            )}
          </div>
        )}

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

            {existingDiary?.fourCutUrl ? (
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                  AI 4컷
                </label>
                <div className="flex flex-wrap items-start gap-3">
                  <img
                    src={existingDiary.fourCutUrl}
                    alt="4컷 일기"
                    className="w-40 rounded-lg border-2 border-green-200 bg-white object-contain shadow"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLiveSceneUrls(existingDiary?.fourCutSceneUrls || [])
                      setLiveFourCutUrl(existingDiary?.fourCutUrl || null)
                      setShowFourCutModal(true)
                    }}
                    className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium font-sans hover:bg-stone-700"
                  >
                    4컷 보기 (애니메이션)
                  </button>
                </div>
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

            {existingDiary?.fourCutUrl && (existingDiary?.attachedImages || []).length > 0 && (
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                  저장된 사진 4컷
                </label>
                <div className="flex flex-wrap items-start gap-3">
                  <img
                    src={existingDiary.fourCutUrl}
                    alt="사진 4컷"
                    className="w-40 rounded-lg border-2 border-green-200 bg-white object-contain shadow"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLiveSceneUrls(existingDiary?.fourCutSceneUrls || existingDiary?.attachedImages || [])
                      setLiveFourCutUrl(existingDiary?.fourCutUrl || null)
                      setShowFourCutModal(true)
                    }}
                    className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium font-sans hover:bg-stone-700"
                  >
                    4컷 보기 (애니메이션)
                  </button>
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

        {isAiOneCut && hasInsufficientTokens && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 font-sans">
            <p className="font-semibold">AI 그림 생성에 토큰이 부족합니다.</p>
            <button
              type="button"
              onClick={openDepositModal}
              className="mt-2 text-sm font-semibold text-amber-700 underline hover:text-amber-900"
            >
              토큰 충전 신청하기 →
            </button>
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
              || isGeneratingImage
              || isSavingWithoutImage
              || isCreatingAiFourCut
              || (needsTokensForAiFourCutSubmit && hasInsufficientTokensForAiFourCut)
              || (needsNewImageOnSave && hasInsufficientTokens)
            }
            className="px-6 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-base font-medium shadow-md font-sans disabled:opacity-50"
          >
            {isCreatingAiFourCut
              ? 'AI 4컷 생성 중...'
              : isGeneratingImage
                ? '이미지 생성 중...'
                : isLoading
                  ? '저장 중...'
                  : isAiFourCut
                    ? existingDiary?.fourCutUrl
                      ? `AI 4컷 다시 만들기 (${aiFourCutCost}토큰)`
                      : `AI 4컷 만들기 (${aiFourCutCost}토큰)`
                    : isPhotoFourCut
                      ? '사진 4컷 저장'
                      : existingDiary?.imageUrl
                        ? `이미지 재생성 (${generationCost}토큰)`
                        : `이미지 생성 (${generationCost}토큰)`}
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
