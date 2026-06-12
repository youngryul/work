import { useState, useEffect } from 'react'
import { getBacklogTasks, createTask, moveToToday } from '../services/taskService.js'
import { getDefaultCategory } from '../services/categoryService.js'
import TaskItem from './TaskItem.jsx'
import CategorySelector from './CategorySelector.jsx'
import CategoryManager from './CategoryManager.jsx'
import { MENU_ICON_PATHS } from '../constants/navigationMenu.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'
import ViewPageTitle from './ViewPageTitle.jsx'

/**
 * 백로그 화면 컴포넌트
 */
export default function BacklogView() {
  const [tasks, setTasks] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('회사') // 기본값 먼저 설정
  const [isLoading, setIsLoading] = useState(true)
  const [defaultCategory, setDefaultCategory] = useState('회사') // 기본값 먼저 설정
  /** 완료 애니메이션 중인 할 일 ID (목록에 유지) */
  const [completingTaskIds, setCompletingTaskIds] = useState(() => new Set())

  /**
   * 기본 카테고리 로드 (비동기로 처리하여 UI 블로킹 방지)
   */
  useEffect(() => {
    const loadDefaultCategory = async () => {
      try {
        const defaultCat = await getDefaultCategory()
        setSelectedCategory(defaultCat)
        setDefaultCategory(defaultCat)
      } catch (error) {
        console.error('기본 카테고리 로드 오류:', error)
        // 오류 발생 시 기본값 유지
      }
    }
    loadDefaultCategory()
    
    // 카테고리 변경 이벤트 리스너
    const handleCategoryChange = () => {
      loadDefaultCategory()
    }
    window.addEventListener('categoryChanged', handleCategoryChange)
    return () => {
      window.removeEventListener('categoryChanged', handleCategoryChange)
    }
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
      // 선택한 카테고리 유지 (기본 카테고리로 리셋하지 않음)
    } catch (error) {
      showToast(error.message || '할 일 추가에 실패했습니다.', TOAST_TYPES.ERROR)
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
   * 완료 애니메이션 시작
   */
  const handleCompleteAnimationStart = (taskId) => {
    setCompletingTaskIds((prev) => new Set(prev).add(taskId))
  }

  /**
   * 할 일 업데이트 (애니메이션 종료 후 완료 상태 반영)
   */
  const handleTaskUpdate = (updatedTask) => {
    setCompletingTaskIds((prev) => {
      const next = new Set(prev)
      next.delete(updatedTask.id)
      return next
    })
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    )
  }

  /**
   * 할 일 삭제
   */
  const handleTaskDelete = (taskId) => {
    setTasks(tasks.filter((t) => t.id !== taskId))
  }


  /** 미완료 + 완료 애니메이션 중인 할 일만 표시 */
  const visibleTasks = tasks.filter(
    (task) => !task.completed || completingTaskIds.has(task.id),
  )

  const defaultCategoryTasks = visibleTasks
    .filter((task) => task.category === defaultCategory)
    .sort((a, b) => (a.createdAt || a.createdat || 0) - (b.createdAt || b.createdat || 0))
  const otherTasks = visibleTasks
    .filter((task) => task.category !== defaultCategory)
    .sort((a, b) => (a.createdAt || a.createdat || 0) - (b.createdAt || b.createdat || 0))

  return (
    <div className="max-w-6xl mx-auto p-6">
      <ViewPageTitle iconSrc={MENU_ICON_PATHS.backlog} title="백로그">
        <p className="text-xl text-gray-600">
          {visibleTasks.length > 0
            ? `총 ${visibleTasks.length}개의 할 일`
            : '백로그가 비어있어요'}
        </p>
      </ViewPageTitle>

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
            className="flex-1 px-4 py-3 text-base border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400 shadow-sm font-sans"
            autoFocus
          />
          <button
            type="submit"
            className="px-6 py-3 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors duration-200 text-2xl font-semibold shadow-sm whitespace-nowrap"
          >
            추가
          </button>
        </div>
      </form>

      {/* 할 일 목록 */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500 text-xl">로딩 중...</div>
      ) : visibleTasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-xl">
          백로그가 비어있어요. 위에서 추가해보세요! ✨
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* 왼쪽: 기본 카테고리 */}
          <div className="space-y-3 overflow-visible">
            {defaultCategoryTasks.length > 0 && (
              <h2 className="text-2xl font-handwriting text-gray-700 mb-3">{defaultCategory}</h2>
            )}
            {defaultCategoryTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={handleTaskUpdate}
                onCompleteAnimationStart={handleCompleteAnimationStart}
                onDelete={handleTaskDelete}
                onMoveToToday={() => handleMoveToToday(task.id)}
              />
            ))}
            {defaultCategoryTasks.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-lg">
                {defaultCategory} 할 일이 없어요
              </div>
            )}
          </div>

          {/* 오른쪽: 나머지 카테고리 */}
          <div className="space-y-3 overflow-visible">
            {otherTasks.length > 0 && (
              <h2 className="text-2xl font-handwriting text-gray-700 mb-3">기타</h2>
            )}
            {otherTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={handleTaskUpdate}
                onCompleteAnimationStart={handleCompleteAnimationStart}
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

