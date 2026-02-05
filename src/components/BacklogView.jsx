import { useState, useEffect, useRef } from 'react'
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
  const [selectedCategory, setSelectedCategory] = useState('회사') // 기본값 먼저 설정
  const [isLoading, setIsLoading] = useState(true)
  const [defaultCategory, setDefaultCategory] = useState('회사') // 기본값 먼저 설정
  const [completedTaskIds, setCompletedTaskIds] = useState(new Set())
  const completionTimersRef = useRef({})

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
   * 할 일 업데이트
   */
  const handleTaskUpdate = async (updatedTask) => {
    const updatedTasks = tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    setTasks(updatedTasks)
    
    // 완료된 경우 새로고침 후 3초 동안 표시
    if (updatedTask.completed && !completedTaskIds.has(updatedTask.id)) {
      // 완료 처리 후 즉시 새로고침하여 최신 데이터 로드
      await loadTasks()
      
      // 새로고침 후 업데이트된 tasks에서 해당 항목을 completedTaskIds에 추가
      setCompletedTaskIds(prev => new Set([...prev, updatedTask.id]))
      
      // 기존 타이머가 있으면 취소
      if (completionTimersRef.current[updatedTask.id]) {
        clearTimeout(completionTimersRef.current[updatedTask.id])
      }
      
      // 3초 후 화면에서 제거 (tasks 배열에는 유지하여 개수는 정확히 표시)
      completionTimersRef.current[updatedTask.id] = setTimeout(() => {
        setCompletedTaskIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(updatedTask.id)
          return newSet
        })
        delete completionTimersRef.current[updatedTask.id]
      }, 3000)
    } else if (!updatedTask.completed && completedTaskIds.has(updatedTask.id)) {
      // 완료 취소된 경우 타이머 취소 및 추적에서 제거
      if (completionTimersRef.current[updatedTask.id]) {
        clearTimeout(completionTimersRef.current[updatedTask.id])
        delete completionTimersRef.current[updatedTask.id]
      }
      setCompletedTaskIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(updatedTask.id)
        return newSet
      })
    }
  }
  
  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      Object.values(completionTimersRef.current).forEach(timer => {
        if (timer) clearTimeout(timer)
      })
    }
  }, [])

  /**
   * 할 일 삭제
   */
  const handleTaskDelete = (taskId) => {
    setTasks(tasks.filter((t) => t.id !== taskId))
  }


  /**
   * 카테고리별로 할 일 분리 및 정렬 (가장 오래된 것부터)
   * 완료된 항목은 3초 동안 표시 후 제외
   */
  const defaultCategoryTasks = tasks
    .filter((task) => task.category === defaultCategory && (!task.completed || completedTaskIds.has(task.id)))
    .sort((a, b) => (a.createdAt || a.createdat || 0) - (b.createdAt || b.createdat || 0))
  const otherTasks = tasks
    .filter((task) => task.category !== defaultCategory && (!task.completed || completedTaskIds.has(task.id)))
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
          {/* 왼쪽: 기본 카테고리 */}
          <div className="space-y-3">
            {defaultCategoryTasks.length > 0 && (
              <h2 className="text-2xl font-handwriting text-gray-700 mb-3">{defaultCategory}</h2>
            )}
            {defaultCategoryTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={handleTaskUpdate}
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

