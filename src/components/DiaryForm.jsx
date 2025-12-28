import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { saveDiary, getDiaryByDate } from '../services/diaryService.js'

/**
 * 일기 작성/수정 폼 컴포넌트
 * @param {string} selectedDate - 선택된 날짜 (YYYY-MM-DD)
 * @param {Function} onSave - 저장 완료 핸들러
 * @param {Function} onCancel - 취소 핸들러
 * @param {boolean} isModal - 모달 안에서 사용되는지 여부
 */
export default function DiaryForm({ selectedDate, onSave, onCancel, isModal = false }) {
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [error, setError] = useState(null)
  const [existingDiary, setExistingDiary] = useState(null)
  const [imageLoadError, setImageLoadError] = useState(false) // 이미지 로드 실패 상태

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
        setImageLoadError(false) // 이미지 로드 상태 초기화
      } else {
        setContent('')
        setExistingDiary(null)
        setImageLoadError(false)
      }
    } catch (error) {
      console.error('일기 로드 실패:', error)
    }
  }

  // 저장
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!content.trim()) {
      alert('일기 내용을 입력해주세요.')
      return
    }

    setIsLoading(true)
    setIsGeneratingImage(true)
    setError(null)

    try {
      await saveDiary(selectedDate, content, false)
      alert('일기가 저장되었습니다. 이미지 생성 중...')
      onSave?.()
    } catch (error) {
      console.error('일기 저장 실패:', error)
      setError(error.message || '일기 저장에 실패했습니다.')
      alert(error.message || '일기 저장에 실패했습니다.')
    } finally {
      setIsLoading(false)
      setIsGeneratingImage(false)
    }
  }

  // 이미지 재생성
  const handleRegenerateImage = async () => {
    if (!content.trim()) {
      alert('일기 내용을 먼저 입력해주세요.')
      return
    }

    setIsGeneratingImage(true)
    setError(null)

    try {
      // 재생성된 일기 데이터를 받아옴
      const updatedDiary = await saveDiary(selectedDate, content, true)
      
      // 반환된 데이터로 즉시 상태 업데이트
      if (updatedDiary) {
        setExistingDiary({
          ...updatedDiary,
          // 브라우저 캐시 방지를 위해 이미지 URL에 타임스탬프 추가
          imageUrl: updatedDiary.imageUrl ? `${updatedDiary.imageUrl}?t=${Date.now()}` : null
        })
        setImageLoadError(false) // 이미지 로드 상태 초기화
      }
      
      // 데이터베이스에서 최신 데이터 다시 로드
      await loadExistingDiary()
      
      // 이미지가 성공적으로 생성되었는지 확인
      if (updatedDiary?.imageUrl) {
        alert('이미지가 재생성되었습니다.')
      } else {
        alert('이미지 생성에 실패했습니다. 일기는 저장되었습니다.')
      }
    } catch (error) {
      console.error('이미지 재생성 실패:', error)
      const errorMessage = error.message || '이미지 재생성에 실패했습니다.'
      setError(errorMessage)
      
      // 사용자 친화적인 에러 메시지 표시
      if (errorMessage.includes('결제 한도') || errorMessage.includes('크레딧') || errorMessage.includes('billing')) {
        alert(`⚠️ ${errorMessage}\n\n일기는 저장되었지만 이미지는 생성되지 않았습니다.`)
      } else {
        alert(`이미지 재생성 실패: ${errorMessage}`)
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
              placeholder="오늘 하루를 기록해보세요..."
              className="w-full h-64 p-4 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans resize-none"
              required
            />
            <p className="text-sm text-gray-500 mt-2 font-sans">
              일기를 저장하면 AI가 자동으로 그림을 생성합니다.
            </p>
          </div>

          {/* 기존 이미지 표시 */}
          {(existingDiary?.imageUrl || isGeneratingImage) && (
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                생성된 이미지
              </label>
              <div className="relative">
                {isGeneratingImage ? (
                  <div className="w-full max-w-md h-64 bg-gray-100 rounded-lg border-2 border-pink-200 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-600 font-sans">이미지 생성 중...</p>
                    </div>
                  </div>
                ) : existingDiary?.imageUrl && !imageLoadError ? (
                  <div className="relative">
                    <img
                      key={existingDiary.imageUrl} // key를 변경하여 강제 리렌더링
                      src={existingDiary.imageUrl}
                      alt="일기 이미지"
                      className="w-full max-w-md rounded-lg border-2 border-pink-200"
                      onError={() => {
                        console.error('이미지 로드 실패:', existingDiary.imageUrl)
                        // React 상태로 이미지 로드 실패 처리
                        setImageLoadError(true)
                      }}
                    />
                  </div>
                ) : existingDiary?.imageUrl && imageLoadError ? (
                  <div className="w-full max-w-md h-64 bg-gray-100 rounded-lg border-2 border-pink-200 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 font-sans mb-2">⚠️ 이미지를 불러올 수 없습니다</p>
                      <p className="text-xs text-gray-500 font-sans">이미지가 만료되었거나 삭제되었을 수 있습니다</p>
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={handleRegenerateImage}
                  disabled={isGeneratingImage}
                  className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium font-sans disabled:opacity-50"
                >
                  {isGeneratingImage ? '재생성 중...' : '🔄 이미지 재생성'}
                </button>
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
          <div className="flex gap-4 justify-end pt-4 border-t-2 border-pink-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border-2 border-pink-200 rounded-lg text-gray-700 hover:bg-pink-50 transition-colors text-base font-medium shadow-md font-sans"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading || isGeneratingImage}
              className="px-6 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors text-base font-medium shadow-md font-sans disabled:opacity-50"
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
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border-2 border-pink-200 p-6">
        {formContent}
      </div>
    </div>
  )
}
