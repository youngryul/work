import { useState, useEffect } from 'react'
import { getBacklogTasks, createTask, moveToToday } from '../services/taskService.js'
import { getDefaultCategory } from '../services/categoryService.js'
import TaskItem from './TaskItem.jsx'
import CategorySelector from './CategorySelector.jsx'
import CategoryManager from './CategoryManager.jsx'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * 백로그 화면 컴포넌트
 */
export default function BacklogView() {
  const [tasks, setTasks] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  /**
   * 기본 카테고리 로드
   */
  useEffect(() => {
    const loadDefaultCategory = async () => {
      const defaultCat = await getDefaultCategory()
      setSelectedCategory(defaultCat)
    }
    loadDefaultCategory()
  }, [])

  /**
   * 백로그 목록 로드
   */
  const loadTasks = async () => {
    setIsLoading(true)
    try {
      const backlogTasks = await getBacklogTasks()
      setTasks(backlogTasks)
    } catch (error) {
      console.error('백로그 로드 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 카테고리 변경 시 목록 새로고침
   */
  const handleCategoryChange = () => {
    loadTasks()
  }

  useEffect(() => {
    loadTasks()
  }, [])

  /**
   * 할 일 추가
   */
  const handleAddTask = async (e) => {
    e.preventDefault()
    if (newTaskTitle.trim() === '') return

    try {
      const newTask = await createTask(newTaskTitle, selectedCategory, false)
      setTasks([newTask, ...tasks])
      setNewTaskTitle('')
      // 기본 카테고리로 리셋
      const defaultCat = await getDefaultCategory()
      setSelectedCategory(defaultCat)
    } catch (error) {
      alert(error.message || '할 일 추가에 실패했습니다.')
    }
  }

  /**
   * 오늘 할 일로 이동
   */
  const handleMoveToToday = async (taskId) => {
    try {
      await moveToToday(taskId)
      setTasks(tasks.filter((t) => t.id !== taskId))
      showToast('오늘 할 일로 이동했습니다!', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error.message || '이동에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 할 일 업데이트
   */
  const handleTaskUpdate = (updatedTask) => {
    setTasks(tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)))
  }

  /**
   * 할 일 삭제
   */
  const handleTaskDelete = (taskId) => {
    setTasks(tasks.filter((t) => t.id !== taskId))
  }

  /**
   * 카테고리별로 할 일 분리 및 정렬 (가장 오래된 것부터)
   */
  const companyTasks = tasks
    .filter((task) => task.category === '회사')
    .sort((a, b) => (a.createdAt || a.createdat || 0) - (b.createdAt || b.createdat || 0))
  const otherTasks = tasks
    .filter((task) => task.category !== '회사')
    .sort((a, b) => (a.createdAt || a.createdat || 0) - (b.createdAt || b.createdat || 0))

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-handwriting text-gray-800 mb-2">
          백로그
        </h1>
        <p className="text-xl text-gray-600">
          {tasks.length > 0
            ? `총 ${tasks.length}개의 할 일`
            : '백로그가 비어있어요'}
        </p>
      </div>

      {/* 카테고리 관리 */}
      <CategoryManager 
        onCategoryChange={handleCategoryChange}
        onCategorySelect={setSelectedCategory}
      />

      {/* 할 일 추가 폼 */}
      <form onSubmit={handleAddTask} className="mb-6">
        <div className="flex gap-2 items-center">
          <CategorySelector
            selectedCategory={selectedCategory}
            onChange={setSelectedCategory}
          />
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="새 할 일을 입력하세요..."
            className="flex-1 px-4 py-3 text-base border-2 border-pink-200 rounded-lg focus:outline-none focus:border-pink-400 shadow-sm font-sans"
            autoFocus
          />
          <button
            type="submit"
            className="px-6 py-3 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors duration-200 text-2xl font-semibold shadow-sm whitespace-nowrap"
          >
            추가
          </button>
        </div>
      </form>

      {/* 할 일 목록 */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500 text-xl">로딩 중...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-xl">
          백로그가 비어있어요. 위에서 추가해보세요! ✨
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* 왼쪽: 회사 카테고리 */}
          <div className="space-y-3">
            {companyTasks.length > 0 && (
              <h2 className="text-2xl font-handwriting text-gray-700 mb-3">회사</h2>
            )}
            {companyTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={handleTaskUpdate}
                onDelete={handleTaskDelete}
                onMoveToToday={() => handleMoveToToday(task.id)}
              />
            ))}
            {companyTasks.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-lg">
                회사 할 일이 없어요
              </div>
            )}
          </div>

          {/* 오른쪽: 나머지 카테고리 */}
          <div className="space-y-3">
            {otherTasks.length > 0 && (
              <h2 className="text-2xl font-handwriting text-gray-700 mb-3">기타</h2>
            )}
            {otherTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={handleTaskUpdate}
                onDelete={handleTaskDelete}
                onMoveToToday={() => handleMoveToToday(task.id)}
              />
            ))}
            {otherTasks.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-lg">
                기타 할 일이 없어요
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

