import { useState, useEffect, useRef } from 'react'
import { updateTask, deleteTask } from '../services/taskService.js'
import { getCategoryEmoji } from '../services/categoryService.js'
import { SYSTEM_CATEGORY_DAILY } from '../constants/categories.js'
import CategorySelector from './CategorySelector.jsx'
import { uploadImage } from '../services/imageService.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * 할 일 항목 컴포넌트
 * @param {Object} props
 * @param {Object} props.task - 할 일 객체
 * @param {Function} props.onUpdate - 업데이트 콜백
 * @param {Function} props.onDelete - 삭제 콜백
 * @param {Function} props.onMoveToToday - 오늘로 이동 콜백 (선택)
 * @param {Function} props.onMoveToBacklog - 백로그로 이동 콜백 (선택)
 */
export default function TaskItem({ task, onUpdate, onDelete, onMoveToToday, onMoveToBacklog }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingCategory, setIsEditingCategory] = useState(false)
  const [isEditingMemo, setIsEditingMemo] = useState(false)
  const [isEditingSchedule, setIsEditingSchedule] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editMemo, setEditMemo] = useState(task.memo || '')
  const [scheduledDate, setScheduledDate] = useState(task.scheduledDate || '')
  const [categoryEmoji, setCategoryEmoji] = useState('📝')
  const [images, setImages] = useState(task.images || [])
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const memoSaveTimerRef = useRef(null)
  const textareaRef = useRef(null)
  
  // 백로그인지 확인 (onMoveToToday가 있으면 백로그)
  const isBacklog = !!onMoveToToday

  useEffect(() => {
    const loadEmoji = async () => {
      const emoji = await getCategoryEmoji(task.category)
      setCategoryEmoji(emoji)
    }
    loadEmoji()
  }, [task.category])

  /**
   * task.memo 변경 시 로컬 상태 업데이트
   */
  useEffect(() => {
    setEditMemo(task.memo || '')
    setImages(task.images || [])
    setScheduledDate(task.scheduledDate || '')
  }, [task.memo, task.images, task.scheduledDate])

  /**
   * 완료 상태 토글
   */
  const handleToggleComplete = async () => {
    try {
      const updated = await updateTask(task.id, { completed: !task.completed })
      onUpdate(updated)
    } catch (error) {
      console.error('완료 상태 변경 오류:', error)
    }
  }

  /**
   * 할 일 삭제
   */
  const handleDelete = async () => {
    if (window.confirm('정말 삭제하시겠어요?')) {
      try {
        await deleteTask(task.id)
        onDelete(task.id)
      } catch (error) {
        console.error('삭제 오류:', error)
      }
    }
  }

  /**
   * 수정 시작
   */
  const handleStartEdit = () => {
    setIsEditing(true)
    setEditTitle(task.title)
  }

  /**
   * 수정 완료
   */
  const handleSaveEdit = async () => {
    if (editTitle.trim() === '') {
      showToast('할 일을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      const updated = await updateTask(task.id, { title: editTitle.trim() })
      onUpdate(updated)
      setIsEditing(false)
    } catch (error) {
      console.error('수정 오류:', error)
    }
  }

  /**
   * 수정 취소
   */
  const handleCancelEdit = () => {
    setEditTitle(task.title)
    setIsEditing(false)
  }

  /**
   * Enter 키 처리
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  /**
   * 카테고리 변경
   */
  const handleCategoryChange = async (newCategory) => {
    try {
      const updated = await updateTask(task.id, { category: newCategory })
      onUpdate(updated)
      setIsEditingCategory(false)
    } catch (error) {
      console.error('카테고리 변경 오류:', error)
    }
  }

  /**
   * 메모 저장 (debounce)
   */
  const saveMemo = async (memoText) => {
    // 기존 타이머 취소
    if (memoSaveTimerRef.current) {
      clearTimeout(memoSaveTimerRef.current)
    }

    // 1초 후 자동 저장
    memoSaveTimerRef.current = setTimeout(async () => {
      try {
        const updated = await updateTask(task.id, { memo: memoText.trim() || null })
        onUpdate(updated)
      } catch (error) {
        console.error('메모 저장 오류:', error)
      }
    }, 1000)
  }

  /**
   * 메모 변경 핸들러
   */
  const handleMemoChange = (e) => {
    const newMemo = e.target.value
    setEditMemo(newMemo)
    saveMemo(newMemo)
  }

  /**
   * 날짜 예약 변경 핸들러
   */
  const handleScheduleDateChange = async (e) => {
    const newDate = e.target.value || null
    setScheduledDate(newDate)
    
    try {
      const updated = await updateTask(task.id, { scheduledDate: newDate })
      onUpdate(updated)
      
      // 날짜가 오늘이면 자동으로 오늘 할일로 이동
      if (newDate) {
        const today = new Date()
        const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        if (newDate === todayString) {
          showToast('오늘 날짜로 예약되어 오늘 할일로 이동했습니다!', TOAST_TYPES.SUCCESS)
        } else {
          showToast('날짜가 예약되었습니다. 해당 날짜에 오늘 할일로 자동 이동됩니다.', TOAST_TYPES.SUCCESS)
        }
      } else {
        showToast('날짜 예약이 취소되었습니다.', TOAST_TYPES.SUCCESS)
      }
    } catch (error) {
      console.error('날짜 예약 오류:', error)
      showToast('날짜 예약에 실패했습니다.', TOAST_TYPES.ERROR)
      // 오류 시 원래 값으로 복구
      setScheduledDate(task.scheduledDate || '')
    }
  }

  /**
   * 이미지 붙여넣기 핸들러
   */
  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault()
        
        const file = item.getAsFile()
        if (!file) continue

        setIsUploadingImage(true)
        try {
          // 이미지를 tasks 폴더에 업로드
          const imageUrl = await uploadImage(file, 'tasks')
          
          // 이미지 URL을 배열에 추가
          const newImages = [...images, imageUrl]
          setImages(newImages)
          
          // 데이터베이스에 저장
          const updated = await updateTask(task.id, { images: newImages })
          onUpdate(updated)
        } catch (error) {
          console.error('이미지 업로드 오류:', error)
          showToast('이미지 업로드에 실패했습니다: ' + (error.message || '알 수 없는 오류'), TOAST_TYPES.ERROR)
        } finally {
          setIsUploadingImage(false)
        }
        break
      }
    }
  }

  /**
   * 이미지 삭제 핸들러
   */
  const handleDeleteImage = async (imageIndex) => {
    const newImages = images.filter((_, index) => index !== imageIndex)
    setImages(newImages)
    
    try {
      const updated = await updateTask(task.id, { images: newImages })
      onUpdate(updated)
    } catch (error) {
      console.error('이미지 삭제 오류:', error)
      showToast('이미지 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 컴포넌트 언마운트 시 타이머 정리
   */
  useEffect(() => {
    return () => {
      if (memoSaveTimerRef.current) {
        clearTimeout(memoSaveTimerRef.current)
      }
    }
  }, [])

  /**
   * 생성된 지 일주일이 지났는지 확인
   */
  const isOlderThanWeek = () => {
    const createdAt = task.createdAt || task.createdat
    if (!createdAt) return false
    
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000 // 7일 전
    return createdAt < oneWeekAgo
  }

  const isOld = isOlderThanWeek()

  return (
    <div
      className={`group flex flex-col gap-3 p-4 rounded-lg transition-all duration-300 animate-fade-in cursor-move ${
        task.completed
          ? 'bg-pink-100 opacity-60'
          : isOld
          ? 'bg-red-200 shadow-sm hover:shadow-md'
          : 'bg-white shadow-sm hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-3">
      {/* 드래그 핸들 */}
      <div className="flex-shrink-0 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="opacity-50 group-hover:opacity-100 transition-opacity"
        >
          <circle cx="7" cy="7" r="1.5" />
          <circle cx="13" cy="7" r="1.5" />
          <circle cx="7" cy="13" r="1.5" />
          <circle cx="13" cy="13" r="1.5" />
        </svg>
      </div>
      {/* 체크박스 */}
      <button
        onClick={handleToggleComplete}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex-shrink-0 w-8 h-8 rounded-full border-2 transition-all duration-200 ${
          task.completed
            ? isOld
              ? 'bg-red-500 border-red-500 checkmark-animate'
              : 'bg-pink-400 border-pink-400 checkmark-animate'
            : isOld
            ? 'border-red-400 hover:border-red-500'
            : 'border-gray-400 hover:border-pink-400'
        }`}
        aria-label={task.completed ? '완료 취소' : '완료'}
      >
        {task.completed && (
          <svg
            className={`w-full h-full checkmark-animate ${
              isOld ? 'text-yellow-300' : 'text-white'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </button>

      {/* 카테고리 이모지 */}
      {task.category === SYSTEM_CATEGORY_DAILY ? (
        <span
          className="flex-shrink-0 text-3xl"
          title="일상 카테고리는 변경할 수 없습니다"
        >
          {categoryEmoji}
        </span>
      ) : (
        <button
          onClick={() => setIsEditingCategory(!isEditingCategory)}
          onMouseDown={(e) => e.stopPropagation()}
          className="flex-shrink-0 text-3xl hover:scale-110 transition-transform duration-200"
          aria-label="카테고리 변경"
          title="카테고리를 변경하려면 클릭하세요"
        >
          {categoryEmoji}
        </button>
      )}

      {/* 할 일 제목 */}
      {isEditing ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSaveEdit}
          onKeyDown={handleKeyPress}
          className="flex-1 px-2 py-1 border-2 border-pink-300 rounded focus:outline-none focus:border-pink-500 text-base font-sans"
          autoFocus
        />
      ) : (
        <span
          onClick={handleStartEdit}
          className={`flex-1 text-base cursor-pointer font-sans relative ${
            task.completed 
              ? 'text-gray-500' 
              : 'text-gray-800'
          }`}
        >
          <span className={task.completed ? 'line-through strike-through-animate' : ''}>
            {task.title}
          </span>
        </span>
      )}

      {/* 버튼 영역 (고정 너비) */}
      <div className="flex-shrink-0 flex items-center gap-2 w-32 justify-end">
        {/* 오늘로 버튼 (백로그에서만 표시) */}
        {onMoveToToday && (
          <button
            onClick={onMoveToToday}
            onMouseDown={(e) => e.stopPropagation()}
            className="px-3 py-1 bg-pink-200 text-pink-700 rounded-lg text-sm hover:bg-pink-300 transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-sm whitespace-nowrap"
          >
            오늘로
          </button>
        )}

        {/* 백로그로 버튼 (오늘 할 일에서만 표시) */}
        {onMoveToBacklog && (
          <button
            onClick={onMoveToBacklog}
            onMouseDown={(e) => e.stopPropagation()}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-sm whitespace-nowrap"
          >
            백로그로
          </button>
        )}

        {/* 날짜 예약 아이콘 버튼 (백로그에서만 표시) */}
        {isBacklog && (
          <button
            onClick={() => setIsEditingSchedule(!isEditingSchedule)}
            onMouseDown={(e) => e.stopPropagation()}
            className={`text-xl transition-all duration-200 ${
              task.scheduledDate
                ? 'text-pink-500 hover:text-pink-600'
                : 'text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100'
            }`}
            aria-label="날짜 예약"
            title={task.scheduledDate ? `예약된 날짜: ${task.scheduledDate}` : '날짜 예약'}
          >
            📅
          </button>
        )}

        {/* 메모 아이콘 버튼 */}
        <button
          onClick={() => setIsEditingMemo(!isEditingMemo)}
          onMouseDown={(e) => e.stopPropagation()}
          className={`text-xl transition-all duration-200 ${
            task.memo || (task.images && task.images.length > 0)
              ? 'text-pink-500 hover:text-pink-600'
              : 'text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100'
          }`}
          aria-label="메모"
          title={task.memo || (task.images && task.images.length > 0) ? '메모 보기/편집' : '메모 추가'}
        >
          📝
        </button>

        {/* 삭제 버튼 */}
        <button
          onClick={handleDelete}
          onMouseDown={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-red-400 hover:text-red-600 text-3xl"
          aria-label="삭제"
        >
          ×
        </button>
      </div>
      </div>

      {/* 카테고리 선택기 (편집 모드일 때만 표시) */}
      {isEditingCategory && (
        <div className="pt-2 border-t border-pink-100">
          <CategorySelector
            selectedCategory={task.category}
            onChange={handleCategoryChange}
          />
        </div>
      )}

      {/* 날짜 예약 입력 영역 (백로그에서만 표시) */}
      {isBacklog && isEditingSchedule && (
        <div className="pt-2 border-t border-pink-100 space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            날짜 예약
          </label>
          <input
            type="date"
            value={scheduledDate}
            onChange={handleScheduleDateChange}
            className="w-full px-3 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:border-pink-400 text-sm font-sans"
            min={new Date().toISOString().split('T')[0]} // 오늘 이후만 선택 가능
          />
          {scheduledDate && (
            <div className="text-xs text-gray-500 mt-1">
              {scheduledDate === new Date().toISOString().split('T')[0] 
                ? '오늘 날짜로 예약되어 오늘 할일로 이동됩니다.'
                : `${scheduledDate}에 오늘 할일로 자동 이동됩니다.`}
            </div>
          )}
          <button
            onClick={() => {
              if (scheduledDate) {
                handleScheduleDateChange({ target: { value: '' } })
              }
              setIsEditingSchedule(false)
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {scheduledDate ? '예약 취소' : '닫기'}
          </button>
        </div>
      )}

      {/* 메모 입력 영역 (편집 모드일 때만 표시) */}
      {isEditingMemo && (
        <div className="pt-2 border-t border-pink-100 space-y-2">
          <textarea
            ref={textareaRef}
            value={editMemo}
            onChange={handleMemoChange}
            onPaste={handlePaste}
            placeholder="메모를 입력하세요... (이미지를 복사하여 붙여넣을 수 있습니다)"
            className="w-full px-3 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:border-pink-400 text-sm font-sans resize-none"
            rows="3"
            disabled={isUploadingImage}
          />
          
          {/* 이미지 업로드 중 표시 */}
          {isUploadingImage && (
            <div className="text-sm text-pink-500 flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              이미지 업로드 중...
            </div>
          )}
          
          {/* 이미지 목록 표시 */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {images.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <img
                    src={imageUrl}
                    alt={`첨부 이미지 ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border-2 border-pink-200"
                  />
                  <button
                    onClick={() => handleDeleteImage(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    aria-label="이미지 삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

