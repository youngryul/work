import { useState, useEffect } from 'react'
import { getTodayTasks, resetTodayTasks, moveToBacklog } from '../services/taskService.js'
import { getDiaryByDate } from '../services/diaryService.js'
import TaskItem from './TaskItem.jsx'
import DiaryReminderModal from './DiaryReminderModal.jsx'

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
const LAST_DIARY_REMINDER_DATE_KEY = 'lastDiaryReminderDate'

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
  const [showDiaryReminder, setShowDiaryReminder] = useState(false)
  const [yesterdayDate, setYesterdayDate] = useState(null)

  /**
   * 날짜 변경 감지 및 리셋 처리
   */
  const checkAndResetIfNeeded = async () => {
    const todayDate = getTodayDateString()
    const lastResetDate = localStorage.getItem(LAST_RESET_DATE_KEY)

    // localStorage에 값이 없으면 (첫 방문 또는 배포 후) 리셋하지 않고 오늘 날짜만 저장
    if (lastResetDate === null) {
      localStorage.setItem(LAST_RESET_DATE_KEY, todayDate)
      return
    }

    // 날짜가 실제로 변경되었을 때만 리셋 실행
    if (lastResetDate !== todayDate) {
      try {
        await resetTodayTasks()
        localStorage.setItem(LAST_RESET_DATE_KEY, todayDate)
        console.log('오늘 할 일이 리셋되었습니다.')
      } catch (error) {
        console.error('날짜 리셋 오류:', error)
      }
    }
  }

  /**
   * 전날 일기 작성 여부 확인 및 리마인더 표시
   */
  const checkYesterdayDiary = async () => {
    const todayDate = getTodayDateString()
    const lastReminderDate = localStorage.getItem(LAST_DIARY_REMINDER_DATE_KEY)
    
    // 오늘 이미 리마인더를 표시했으면 스킵
    if (lastReminderDate === todayDate) {
      return
    }

    // 어제 날짜 확인
    const yesterday = getYesterdayDateString()
    
    try {
      // 어제 일기 확인
      const diary = await getDiaryByDate(yesterday)
      
      // 일기가 없으면 리마인더 표시
      if (!diary) {
        setYesterdayDate(yesterday)
        setShowDiaryReminder(true)
        localStorage.setItem(LAST_DIARY_REMINDER_DATE_KEY, todayDate)
      }
    } catch (error) {
      console.error('일기 확인 오류:', error)
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
    // 전날 일기 확인 (약간의 지연을 두어 초기 로딩 후 실행)
    setTimeout(() => {
      checkYesterdayDiary()
    }, 1000)
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

  /**
   * 일기 작성 완료 핸들러
   */
  const handleDiaryWritten = () => {
    // 할 일 목록 새로고침 (일기 작성 todo가 추가되었을 수 있음)
    loadTasks()
  }

  return (
    <>
      <div className="max-w-2xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-6xl font-handwriting text-gray-800 mb-2">
            오늘 할 일
          </h1>
          <p className="text-2xl text-gray-500 mb-2">
            {getCurrentDateString()}
          </p>
          <p className="text-3xl text-gray-600">
            {tasks.length > 0
              ? `${completedCount}개 완료 / ${tasks.length}개`
              : '오늘은 무엇을 할까요?'}
          </p>
        </div>

        {/* 할 일 목록 */}
        {isLoading ? (
          <div className="text-center py-8 text-gray-500 text-3xl">로딩 중...</div>
        ) : incompleteTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-3xl">
            {tasks.length === 0
              ? '아직 할 일이 없어요. 백로그에서 추가 후 오늘 할 일로 이동해주세요! ✨'
              : '모든 할 일을 완료했어요! 🎉'}
          </div>
        ) : (
          <div className="space-y-3">
            {incompleteTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={handleTaskUpdate}
                onDelete={handleTaskDelete}
                onMoveToBacklog={() => handleMoveToBacklog(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 전날 일기 작성 리마인더 모달 */}
      <DiaryReminderModal
        yesterdayDate={yesterdayDate}
        isOpen={showDiaryReminder}
        onClose={() => {
          setShowDiaryReminder(false)
          loadTasks() // 할 일 목록 새로고침
        }}
        onWriteDiary={handleDiaryWritten}
      />
    </>
  )
}

