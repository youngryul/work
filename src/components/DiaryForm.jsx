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
import { showToast, TOAST_TYPES } from './Toast.jsx'

const EMOTION_LABELS = {
  calm: '평온',
  comfort: '편안',
  happiness: '행복',
  sadness: '슬픔',
  anxiety: '불안',
  loneliness: '외로움',
  hope: '희망',
  tiredness: '피곤',
  excitement: '설렘',
  gratitude: '감사',
  nostalgia: '그리움',
  frustration: '답답',
  relief: '안도',
  pride: '뿌듯함',
  embarrassment: '부끄러움',
  envy: '부러움',
  determination: '의지',
  confusion: '혼란',
  peace: '평화',
  love: '사랑',
  anger: '화남',
  disappointment: '실망',
  satisfaction: '만족',
}

/**
 * 일기 작성/수정 폼 컴포넌트
 * @param {string} selectedDate - 선택된 날짜 (YYYY-MM-DD)
 * @param {Function} onSave - 저장 완료 핸들러
 * @param {Function} onCancel - 취소 핸들러
 * @param {boolean} isModal - 모달 안에서 사용되는지 여부
 * @param {boolean} embedded - 상위 화면에서 토큰 배지를 표시하는 경우
 * @param {unknown} tokenRefreshDep - 토큰 배지 새로고침 트리거
 */
export default function DiaryForm({
  selectedDate,
  onSave,
  onCancel,
  isModal = false,
  embedded = false,
  tokenRefreshDep,
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

  const { balance: tokenBalance, generationCost } = useAiTokenInfo(
    tokenRefreshDep ?? selectedDate,
  )

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
        setDiaryEmotion(diary.emotion ? (EMOTION_LABELS[diary.emotion] ?? diary.emotion) : null)
      } else {
        setContent('')
        setExistingDiary(null)
        setImageLoadError(false)
        setAttachedImages([])
        setDiaryEmotion(null)
      }
    } catch (error) {
      console.error('일기 로드 실패:', error)
    }
  }

  const hasInsufficientTokens =
    tokenBalance !== null && tokenBalance < generationCost
  const needsNewImageOnSave = !existingDiary?.imageUrl

  // 저장
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!content.trim()) {
      showToast('일기 내용을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    setIsLoading(true)
    setIsGeneratingImage(true)
    setError(null)

    try {
      const saved = await saveDiary(selectedDate, content, false, attachedImages)
      if (saved?.emotion) setDiaryEmotion(EMOTION_LABELS[saved.emotion] ?? saved.emotion)
      const saveMsg = saved?.tokensConsumed
        ? `일기가 저장되었습니다. (${generationCost}토큰 사용)`
        : '일기가 저장되었습니다.'
      showToast(saveMsg, TOAST_TYPES.SUCCESS)

      // 어제 일기를 작성한 경우 리마인더 표시 기록
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayDateString = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
      
      if (selectedDate === yesterdayDateString) {
        try {
          await markDiaryReminderShown(user?.id)
          // 알림 상태 새로고침
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('refreshNotifications'))
          }, 500)
        } catch (error) {
          console.error('리마인더 기록 실패:', error)
        }
      }
      
      onSave?.()
    } catch (error) {
      console.error('일기 저장 실패:', error)
      setError(error.message || '일기 저장에 실패했습니다.')
      showToast(error.message || '일기 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
      setIsGeneratingImage(false)
    }
  }

  /**
   * 파일 업로드 핸들러
   */
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    for (const file of files) {
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(2)}`
      setUploadingImages(prev => ({ ...prev, [fileId]: true }))

      try {
        const imageUrl = await uploadImage(file, 'diaries')
        setAttachedImages(prev => [...prev, imageUrl])
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

    // 파일 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * 클립보드에서 이미지 붙여넣기
   */
  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue

        const fileId = `${Date.now()}-${Math.random().toString(36).substring(2)}`
        setUploadingImages(prev => ({ ...prev, [fileId]: true }))

        try {
          const imageUrl = await uploadImage(file, 'diaries')
          setAttachedImages(prev => [...prev, imageUrl])
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
      showToast(
        `AI 이미지 생성 토큰이 부족합니다. (보유: ${tokenBalance}, 필요: ${generationCost})`,
        TOAST_TYPES.ERROR,
      )
      return
    }

    setIsGeneratingImage(true)
    setError(null)

    try {
      // 재생성된 일기 데이터를 받아옴
      const updatedDiary = await saveDiary(selectedDate, content, true, attachedImages)
      
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
      if (errorMessage.includes('결제 한도') || errorMessage.includes('크레딧') || errorMessage.includes('billing')) {
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

  const formContent = (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 font-sans">
          {existingDiary ? '일기 수정' : '일기 작성'}
        </h1>
        <p className="text-base text-gray-600 font-sans">
          {selectedDate && formatDate(selectedDate)}
        </p>
        <AiTokenGenerationCostNote cost={generationCost} className="mt-2" />
      </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 일기 내용 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              오늘의 일기
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              placeholder="오늘 하루를 기록해보세요... (이미지를 복사해서 붙여넣을 수 있습니다)"
              className="w-full h-64 p-4 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans resize-none"
              required
            />
            <p className="text-sm text-gray-500 mt-2 font-sans">
              일기를 저장하면 AI가 자동으로 그림을 생성합니다.
            </p>
          </div>

          {/* 첨부 이미지 업로드 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              사진 첨부
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
                  또는 이미지를 복사해서 붙여넣으세요 (Ctrl+V / Cmd+V)
                </p>
              </div>

              {/* 업로드 중 표시 */}
              {Object.keys(uploadingImages).length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600 font-sans">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                  <span>이미지 업로드 중...</span>
                </div>
              )}
            </div>
          </div>

          {/* 첨부 이미지 표시 */}
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

          {/* 기존 이미지 표시 */}
          {(existingDiary?.imageUrl || isGeneratingImage) && (
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                생성된 이미지
              </label>
              <div className="relative">
                {isGeneratingImage ? (
                  <div className="w-full max-w-md h-64 bg-gray-100 rounded-lg border-2 border-green-200 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600 font-sans">이미지 생성 중...</p>
                    </div>
                  </div>
                ) : existingDiary?.imageUrl && !imageLoadError ? (
                  <div className="relative">
                    <img
                      key={existingDiary.imageUrl} // key를 변경하여 강제 리렌더링
                      src={existingDiary.imageUrl}
                      alt="일기 이미지"
                      className="w-full max-w-md rounded-lg border-2 border-green-200"
                      onError={() => {
                        console.error('이미지 로드 실패:', existingDiary.imageUrl)
                        // React 상태로 이미지 로드 실패 처리
                        setImageLoadError(true)
                      }}
                    />
                    {diaryEmotion && (
                      <p className="mt-2 text-sm text-gray-500 font-sans">
                        오늘의 감정: <span className="font-semibold text-green-600">{diaryEmotion}</span>
                      </p>
                    )}
                  </div>
                ) : existingDiary?.imageUrl && imageLoadError ? (
                  <div className="w-full max-w-md h-64 bg-gray-100 rounded-lg border-2 border-green-200 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 font-sans mb-2">⚠️ 이미지를 불러올 수 없습니다</p>
                      <p className="text-xs text-gray-500 font-sans">이미지가 만료되었거나 삭제되었을 수 있습니다</p>
                    </div>
                  </div>
                ) : null}
                <div className="flex gap-2 mt-2">
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
                {/* 프롬프트 표시 (관리자만) */}
                {isAdmin && showPrompt && existingDiary?.imagePrompt && (
                  <div className="mt-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 font-sans">생성된 프롬프트:</h4>
                    <p className="text-xs text-gray-600 font-mono whitespace-pre-wrap break-words font-sans">
                      {existingDiary.imagePrompt}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-sans">{error}</p>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-4 justify-end pt-4 border-t-2 border-green-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border-2 border-green-200 rounded-lg text-gray-700 hover:bg-green-50 transition-colors text-base font-medium shadow-md font-sans"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading || isGeneratingImage}
              className="px-6 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-base font-medium shadow-md font-sans disabled:opacity-50"
            >
              {isGeneratingImage ? '이미지 생성 중...' : isLoading ? '저장 중...' : existingDiary ? '수정' : '저장'}
            </button>
          </div>
        </form>
    </>
  )

  // 모달 안에서 사용되는 경우
  if (isModal) {
    return formContent
  }

  // 일반 화면에서 사용되는 경우
  if (embedded) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border-2 border-green-200 p-6">
        {formContent}
      </div>
    )
  }

  return (
    <div className="relative max-w-4xl mx-auto p-6 pt-14">
      <AiTokenBalanceBadge refreshDep={tokenRefreshDep ?? selectedDate} />
      <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border-2 border-green-200 p-6">
        {formContent}
      </div>
    </div>
  )
}
