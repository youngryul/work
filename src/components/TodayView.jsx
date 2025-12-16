import { useState, useEffect } from 'react'
import { getTodayTasks } from '../services/taskService.js'
import TaskItem from './TaskItem.jsx'

/**
 * 오늘 할 일 화면 컴포넌트
 */
export default function TodayView() {
  const [tasks, setTasks] = useState([])
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
        <h1 className="text-6xl font-handwriting text-gray-800 mb-2">
          오늘 할 일
        </h1>
        <p className="text-3xl text-gray-600">
          {tasks.length > 0
            ? `${completedCount}개 완료 / ${tasks.length}개`
            : '오늘은 무엇을 할까요?'}
        </p>
      </div>

      {/* 할 일 목록 */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500 text-3xl">로딩 중...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-3xl">
          아직 할 일이 없어요. 백로그에서 추가 후 오늘 할 일로 이동해주세요! ✨
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

