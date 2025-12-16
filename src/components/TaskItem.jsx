import { useState } from 'react'
import { updateTask, deleteTask } from '../services/taskService.js'
import { CATEGORY_EMOJIS } from '../constants/categories.js'

/**
 * 할 일 항목 컴포넌트
 * @param {Object} props
 * @param {Object} props.task - 할 일 객체
 * @param {Function} props.onUpdate - 업데이트 콜백
 * @param {Function} props.onDelete - 삭제 콜백
 */
export default function TaskItem({ task, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)

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

  return (
    <div
      className={`group flex items-center gap-3 p-4 rounded-lg transition-all duration-300 animate-fade-in ${
        task.completed
          ? 'bg-pink-100 opacity-60'
          : 'bg-white shadow-sm hover:shadow-md'
      }`}
    >
      {/* 체크박스 */}
      <button
        onClick={handleToggleComplete}
        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all duration-200 ${
          task.completed
            ? 'bg-pink-400 border-pink-400 checkmark-animate'
            : 'border-gray-300 hover:border-pink-400'
        }`}
        aria-label={task.completed ? '완료 취소' : '완료'}
      >
        {task.completed && (
          <svg
            className="w-full h-full text-white checkmark-animate"
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
      <span className="text-2xl flex-shrink-0">
        {CATEGORY_EMOJIS[task.category] || '📝'}
      </span>

      {/* 할 일 제목 */}
      {isEditing ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSaveEdit}
          onKeyDown={handleKeyPress}
          className="flex-1 px-2 py-1 border-2 border-pink-300 rounded focus:outline-none focus:border-pink-500 text-lg"
          autoFocus
        />
      ) : (
        <span
          onClick={handleStartEdit}
          className={`flex-1 text-lg cursor-pointer ${
            task.completed ? 'line-through text-gray-500' : 'text-gray-800'
          }`}
        >
          {task.title}
        </span>
      )}

      {/* 삭제 버튼 */}
      <button
        onClick={handleDelete}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-red-400 hover:text-red-600 text-xl"
        aria-label="삭제"
      >
        ×
      </button>
    </div>
  )
}

