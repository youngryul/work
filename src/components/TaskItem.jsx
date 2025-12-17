import { useState, useEffect } from 'react'
import { updateTask, deleteTask } from '../services/taskService.js'
import { getCategoryEmoji } from '../services/categoryService.js'
import CategorySelector from './CategorySelector.jsx'

/**
 * 할 일 항목 컴포넌트
 * @param {Object} props
 * @param {Object} props.task - 할 일 객체
 * @param {Function} props.onUpdate - 업데이트 콜백
 * @param {Function} props.onDelete - 삭제 콜백
 */
export default function TaskItem({ task, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingCategory, setIsEditingCategory] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [categoryEmoji, setCategoryEmoji] = useState('📝')

  useEffect(() => {
    const loadEmoji = async () => {
      const emoji = await getCategoryEmoji(task.category)
      setCategoryEmoji(emoji)
    }
    loadEmoji()
  }, [task.category])

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
      alert('할 일을 입력해주세요.')
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
      className={`group flex flex-col gap-3 p-4 rounded-lg transition-all duration-300 animate-fade-in ${
        task.completed
          ? 'bg-pink-100 opacity-60'
          : isOld
          ? 'bg-red-200 shadow-sm hover:shadow-md'
          : 'bg-white shadow-sm hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-3">
      {/* 체크박스 */}
      <button
        onClick={handleToggleComplete}
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
      <button
        onClick={() => setIsEditingCategory(!isEditingCategory)}
        className="flex-shrink-0 text-3xl hover:scale-110 transition-transform duration-200"
        aria-label="카테고리 변경"
        title="카테고리를 변경하려면 클릭하세요"
      >
        {categoryEmoji}
      </button>

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
          className={`flex-1 text-base cursor-pointer font-sans ${
            task.completed ? 'line-through text-gray-500' : 'text-gray-800'
          }`}
        >
          {task.title}
        </span>
      )}

      {/* 삭제 버튼 */}
      <button
        onClick={handleDelete}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-red-400 hover:text-red-600 text-3xl"
        aria-label="삭제"
      >
        ×
      </button>
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
    </div>
  )
}

