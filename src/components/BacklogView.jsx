import { useState, useEffect } from 'react'
import { getBacklogTasks, createTask, moveToToday } from '../services/taskService.js'
import { DEFAULT_CATEGORY, MAX_TODAY_TASKS } from '../constants/categories.js'
import TaskItem from './TaskItem.jsx'

/**
 * 백로그 화면 컴포넌트
 */
export default function BacklogView() {
  const [tasks, setTasks] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)

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
      const newTask = await createTask(newTaskTitle, DEFAULT_CATEGORY, false)
      setTasks([newTask, ...tasks])
      setNewTaskTitle('')
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
      alert('오늘 할 일로 이동했습니다!')
    } catch (error) {
      alert(error.message || '이동에 실패했습니다.')
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

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-5xl font-handwriting text-gray-800 mb-2">
          백로그
        </h1>
        <p className="text-xl text-gray-600">
          {tasks.length > 0
            ? `총 ${tasks.length}개의 할 일`
            : '백로그가 비어있어요'}
        </p>
      </div>

      {/* 할 일 추가 폼 */}
      <form onSubmit={handleAddTask} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="새 할 일을 입력하세요..."
            className="flex-1 px-4 py-3 text-lg border-2 border-pink-200 rounded-lg focus:outline-none focus:border-pink-400 shadow-sm"
            autoFocus
          />
          <button
            type="submit"
            className="px-6 py-3 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors duration-200 text-lg font-semibold shadow-sm"
          >
            추가
          </button>
        </div>
      </form>

      {/* 할 일 목록 */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500 text-xl">로딩 중...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-2xl">
          백로그가 비어있어요. 위에서 추가해보세요! ✨
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="relative group">
              <TaskItem
                task={task}
                onUpdate={handleTaskUpdate}
                onDelete={handleTaskDelete}
              />
              <button
                onClick={() => handleMoveToToday(task.id)}
                className="absolute right-12 top-1/2 -translate-y-1/2 px-3 py-1 bg-pink-200 text-pink-700 rounded-lg text-sm hover:bg-pink-300 transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-sm"
              >
                오늘로
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

