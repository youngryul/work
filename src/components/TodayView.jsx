import { useState, useEffect, useRef } from 'react'
import { getTodayTasks, resetTodayTasks, moveToBacklog, updateTaskPriorities } from '../services/taskService.js'
import TaskItem from './TaskItem.jsx'
import { getWeekStart, getWeekEnd } from '../services/workReportService.js'
import { getWeeksWithWorkReports, getWeeksWithDiaries } from '../services/workReportService.js'
import { getDiariesByMonth } from '../services/diaryService.js'

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 * @returns {string} 오늘 날짜 문자열
 */
const getTodayDateString = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * localStorage 키 상수
 */
const LAST_RESET_DATE_KEY = 'lastResetDate'

/**
 * 어제 날짜를 YYYY-MM-DD 형식으로 반환
 * @returns {string} 어제 날짜 문자열
 */
const getYesterdayDateString = () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const year = yesterday.getFullYear()
  const month = String(yesterday.getMonth() + 1).padStart(2, '0')
  const day = String(yesterday.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 오늘 할 일 화면 컴포넌트
 */
export default function TodayView() {
  const [tasks, setTasks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragStartIndexRef = useRef(null)

  /**
   * 날짜 변경 감지 및 리셋 처리
   * 날짜가 실제로 변경되었을 때만 백로그로 이동
   * 재접속 시에는 리셋하지 않음
   */
  const checkAndResetIfNeeded = async () => {
    const todayDate = getTodayDateString()
    const lastResetDate = localStorage.getItem(LAST_RESET_DATE_KEY)

    // localStorage에 값이 없으면 (첫 방문 또는 배포 후) 리셋하지 않고 오늘 날짜만 저장
    // 재접속 시에도 날짜가 변경되지 않았으면 리셋하지 않음
    if (lastResetDate === null || lastResetDate === '') {
      localStorage.setItem(LAST_RESET_DATE_KEY, todayDate)
      return
    }

    // 날짜 형식 검증 (YYYY-MM-DD 형식인지 확인)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (!datePattern.test(lastResetDate)) {
      localStorage.setItem(LAST_RESET_DATE_KEY, todayDate)
      return
    }

    // 날짜가 실제로 변경되었을 때만 리셋 실행
    // 이중 확인: 날짜가 정확히 다른지 확인
    if (lastResetDate !== todayDate) {
      // 날짜 차이 계산 (하루 차이인지 확인)
      const lastDate = new Date(lastResetDate + 'T00:00:00')
      const today = new Date(todayDate + 'T00:00:00')
      const diffTime = today - lastDate
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
      
      // 날짜가 실제로 변경되었고 (1일 이상 차이), 오늘 할 일이 있는 경우에만 리셋
      if (diffDays >= 1) {
        try {
          // 리셋 전에 오늘 할 일이 실제로 있는지 확인
          const currentTasks = await getTodayTasks()
          if (currentTasks && currentTasks.length > 0) {
            await resetTodayTasks()
          }
          // 리셋 성공 여부와 관계없이 날짜 업데이트 (다음 날짜 변경 시 올바르게 동작하도록)
          localStorage.setItem(LAST_RESET_DATE_KEY, todayDate)
        } catch (error) {
          console.error('[리셋 오류] 날짜 리셋 중 오류 발생:', error)
          // 오류 발생 시에도 날짜는 업데이트하지 않음 (다음에 다시 시도)
          // 하지만 날짜가 실제로 변경된 경우에는 업데이트해야 함
          // 단, 오류가 발생한 경우에는 다음에 다시 시도할 수 있도록 날짜를 업데이트하지 않음
        }
      } else {
        // 날짜가 변경되지 않았지만 localStorage의 날짜가 다른 경우 (예: 시간대 변경 등)
        // 오늘 날짜로 업데이트만 하고 리셋하지 않음
        localStorage.setItem(LAST_RESET_DATE_KEY, todayDate)
      }
    }
    // 날짜가 같으면 아무것도 하지 않음 (재접속 시 정상 동작)
  }


  /**
   * 할 일 목록 로드
   */
  const loadTasks = async () => {
    setIsLoading(true)
    try {
      // 먼저 날짜 변경 확인 및 리셋
      await checkAndResetIfNeeded()
      // 그 다음 오늘 할 일 로드
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
    
    // 오늘 할일 새로고침 이벤트 리스너
    const handleRefreshTasks = () => {
      loadTasks()
    }
    
    window.addEventListener('refreshTodayTasks', handleRefreshTasks)
    
    return () => {
      window.removeEventListener('refreshTodayTasks', handleRefreshTasks)
    }
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
   * 백로그로 이동
   */
  const handleMoveToBacklog = async (taskId) => {
    try {
      await moveToBacklog(taskId)
      setTasks(tasks.filter((t) => t.id !== taskId))
      alert('백로그로 이동했습니다!')
    } catch (error) {
      alert(error.message || '이동에 실패했습니다.')
    }
  }

  /**
   * 완료된 할 일 개수 계산
   */
  const completedCount = tasks.filter((t) => t.completed).length

  /**
   * 미완료 할 일만 필터링 및 정렬
   */
  const incompleteTasks = tasks
    .filter((task) => !task.completed)
    .sort((a, b) => {
      // priority 기준 오름차순
      const aPriority = a.priority || 0
      const bPriority = b.priority || 0
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      // movedtotodayat 기준 오름차순
      const aMoved = a.movedToTodayAt || a.createdAt
      const bMoved = b.movedToTodayAt || b.createdAt
      if (aMoved !== bMoved) {
        return aMoved - bMoved
      }
      // createdat 기준 오름차순
      return a.createdAt - b.createdAt
    })

  /**
   * 드래그 시작 핸들러
   */
  const handleDragStart = (e, taskId, index) => {
    setDraggedTaskId(taskId)
    dragStartIndexRef.current = index
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', taskId)
  }

  /**
   * 드래그 오버 핸들러
   */
  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  /**
   * 드래그 리브 핸들러
   */
  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  /**
   * 드롭 핸들러
   */
  const handleDrop = async (e, dropIndex) => {
    e.preventDefault()
    setDragOverIndex(null)

    if (draggedTaskId === null || dragStartIndexRef.current === null) {
      return
    }

    const startIndex = dragStartIndexRef.current
    if (startIndex === dropIndex) {
      setDraggedTaskId(null)
      dragStartIndexRef.current = null
      return
    }

    // 로컬 상태 업데이트 (즉시 반영)
    const newTasks = [...incompleteTasks]
    const [draggedTask] = newTasks.splice(startIndex, 1)
    newTasks.splice(dropIndex, 0, draggedTask)

    // priority 재계산
    const priorityUpdates = newTasks.map((task, index) => ({
      id: task.id,
      priority: index,
    }))

    // 로컬 상태 먼저 업데이트
    const updatedTasks = newTasks.map((task, index) => ({
      ...task,
      priority: index,
    }))
    
    // 전체 tasks 배열 업데이트
    const allTasks = tasks.map((task) => {
      const updated = updatedTasks.find((t) => t.id === task.id)
      return updated || task
    })
    setTasks(allTasks)

    // DB 업데이트
    try {
      await updateTaskPriorities(priorityUpdates)
    } catch (error) {
      console.error('우선순위 업데이트 오류:', error)
      // 에러 발생 시 원래 상태로 복구
      loadTasks()
    }

    setDraggedTaskId(null)
    dragStartIndexRef.current = null
  }

  /**
   * 드래그 종료 핸들러
   */
  const handleDragEnd = () => {
    setDraggedTaskId(null)
    setDragOverIndex(null)
    dragStartIndexRef.current = null
  }

  /**
   * 현재 날짜 포맷팅
   */
  const getCurrentDateString = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const weekday = weekdays[today.getDay()]
    return `${year}년 ${month}월 ${day}일 (${weekday})`
  }


  return (
    <>
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-handwriting text-gray-800 mb-2">
            오늘 할 일
          </h1>
          <p className="text-lg text-gray-500 mb-2">
            {getCurrentDateString()}
          </p>
          <p className="text-xl text-gray-600">
            {tasks.length > 0
              ? `${completedCount}개 완료 / ${tasks.length}개`
              : '오늘은 무엇을 할까요?'}
          </p>
        </div>

        {/* 할 일 목록 */}
        {isLoading ? (
          <div className="text-center py-8 text-gray-500 text-xl">로딩 중...</div>
        ) : incompleteTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xl">
            {tasks.length === 0
              ? '아직 할 일이 없어요. 백로그에서 추가 후 오늘 할 일로 이동해주세요! ✨'
              : '모든 할 일을 완료했어요! 🎉'}
          </div>
        ) : (
          <div className="space-y-3">
            {incompleteTasks.map((task, index) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => handleDragStart(e, task.id, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`transition-all duration-200 ${
                  draggedTaskId === task.id
                    ? 'opacity-50'
                    : dragOverIndex === index
                    ? 'transform translate-y-1'
                    : ''
                }`}
              >
                <TaskItem
                  task={task}
                  onUpdate={handleTaskUpdate}
                  onDelete={handleTaskDelete}
                  onMoveToBacklog={() => handleMoveToBacklog(task.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

    </>
  )
}

