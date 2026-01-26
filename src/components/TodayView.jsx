import { useState, useEffect, useRef } from 'react'
import { getTodayTasks, resetTodayTasks, moveToBacklog, updateTaskPriorities } from '../services/taskService.js'
import TaskItem from './TaskItem.jsx'
import { getWeekStart, getWeekEnd } from '../services/workReportService.js'
import { getWeeksWithWorkReports, getWeeksWithDiaries } from '../services/workReportService.js'
import { getDiariesByMonth } from '../services/diaryService.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

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
  const [completedTaskIds, setCompletedTaskIds] = useState(new Set()) // 완료된 항목 ID 추적 (3초 동안 표시)
  const completionTimersRef = useRef({}) // 완료 타이머 추적

  /**
   * 날짜 변경 감지 및 리셋 처리
   * 오늘 할일의 movedToTodayAt 필드를 확인하여 어제 이전에 추가된 항목만 리셋
   * 배포나 재로그인 시에도 정확하게 동작
   */
  const checkAndResetIfNeeded = async () => {
    try {
      const todayDate = getTodayDateString()
      const today = new Date(todayDate + 'T00:00:00')
      const todayStartTimestamp = today.getTime()
      
      // 오늘 할 일 중 어제 이전에 추가된 항목 확인
      const currentTasks = await getTodayTasks()
      
      if (!currentTasks || currentTasks.length === 0) {
        return
      }

      // movedToTodayAt이 어제 이전인 항목들 필터링
      const tasksToReset = currentTasks.filter(task => {
        // movedToTodayAt이 없으면 createdAt 사용
        const movedAt = task.movedToTodayAt || task.createdAt
        if (!movedAt) return false
        
        // movedAt이 오늘 00:00:00 이전이면 리셋 대상
        return movedAt < todayStartTimestamp
      })

      // 리셋 대상이 있으면 리셋 실행
      if (tasksToReset.length > 0) {
        await resetTodayTasks()
      }
    } catch (error) {
      console.error('[리셋 오류] 날짜 리셋 중 오류 발생:', error)
      // 오류 발생 시에도 계속 진행 (할 일 목록은 로드)
    }
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
   * 백로그로 이동
   */
  const handleMoveToBacklog = async (taskId) => {
    try {
      await moveToBacklog(taskId)
      setTasks(tasks.filter((t) => t.id !== taskId))
      showToast('백로그로 이동했습니다!', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error.message || '이동에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 완료된 할 일 개수 계산
   */
  const completedCount = tasks.filter((t) => t.completed).length

  /**
   * 미완료 할 일만 필터링 및 정렬 (완료된 항목은 3초 동안 표시 후 제외)
   */
  const incompleteTasks = tasks
    .filter((task) => !task.completed || completedTaskIds.has(task.id))
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

