import { useState, useEffect } from 'react'
import { getTodayTasks, createTask } from '../services/taskService.js'
import { DEFAULT_CATEGORY, MAX_TODAY_TASKS } from '../constants/categories.js'
import TaskItem from './TaskItem.jsx'

/**
 * 오늘 할 일 화면 컴포넌트
 */
export default function TodayView() {
  const [tasks, setTasks] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  /**
   * 할 일 목록 로드
   */
  const loadTasks = async () => {
    setIsLoading(true)
    try {
      const todayTasks = await getTodayTasks()
      setTasks(todayTasks)
    } catch (error) {
      console.error('할 일 로드 오류:', error)
    } finally {
      setIsLoading(false)
    }
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

    if (tasks.length >= MAX_TODAY_TASKS) {
      alert(`오늘 할 일은 최대 ${MAX_TODAY_TASKS}개까지 추가할 수 있습니다.`)
      return
    }

    try {
      const newTask = await createTask(newTaskTitle, DEFAULT_CATEGORY, true)
      setTasks([newTask, ...tasks])
      setNewTaskTitle('')
    } catch (error) {
      alert(error.message || '할 일 추가에 실패했습니다.')
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
   * 완료된 할 일 개수 계산
   */
  const completedCount = tasks.filter((t) => t.completed).length

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-5xl font-handwriting text-gray-800 mb-2">
          오늘 할 일
        </h1>
        <p className="text-xl text-gray-600">
          {tasks.length > 0
            ? `${completedCount}개 완료 / ${tasks.length}개`
            : '오늘은 무엇을 할까요?'}
        </p>
      </div>

      {/* 할 일 추가 폼 */}
      <form onSubmit={handleAddTask} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="할 일을 입력하세요..."
            className="flex-1 px-4 py-3 text-lg border-2 border-pink-200 rounded-lg focus:outline-none focus:border-pink-400 shadow-sm"
            autoFocus
          />
          <button
            type="submit"
            disabled={tasks.length >= MAX_TODAY_TASKS}
            className="px-6 py-3 bg-pink-400 text-white rounded-lg hover:bg-pink-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 text-lg font-semibold shadow-sm"
          >
            추가
          </button>
        </div>
        {tasks.length >= MAX_TODAY_TASKS && (
          <p className="mt-2 text-sm text-gray-500">
            오늘 할 일은 최대 {MAX_TODAY_TASKS}개까지 추가할 수 있습니다.
          </p>
        )}
      </form>

      {/* 할 일 목록 */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500 text-xl">로딩 중...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-2xl">
          아직 할 일이 없어요. 위에서 추가해보세요! ✨
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onUpdate={handleTaskUpdate}
              onDelete={handleTaskDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

