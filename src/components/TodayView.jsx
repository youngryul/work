import { useState, useEffect, useRef } from 'react'
import {
  getTodayTasks,
  resetTodayTasks,
  moveToBacklog,
  updateTaskPriorities,
  moveScheduledTasksToToday,
  moveTasksToTimeSlot,
  moveTasksToBacklog,
} from '../services/taskService.js'
import { applyDailyRoutinesToToday } from '../services/routineService.js'
import TaskItem from './TaskItem.jsx'
import { getWeekStart, getWeekEnd } from '../services/workReportService.js'
import { getWeeksWithWorkReports, getWeeksWithDiaries } from '../services/workReportService.js'
import { getDiariesByMonth } from '../services/diaryService.js'
import { MENU_ICON_PATHS } from '../constants/navigationMenu.js'
import { APP_THEMES, shouldShowTodayExcelGrid } from '../constants/appThemes.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'
import ViewPageTitle from './ViewPageTitle.jsx'
import DiaryMemoryCard from './DiaryMemoryCard.jsx'
import TimeSlotSection from './today/TimeSlotSection.jsx'
import TimeSlotCleanupBanner from './today/TimeSlotCleanupBanner.jsx'
import {
  TIME_SLOTS,
  UNASSIGNED_SLOT,
  UNASSIGNED_SLOT_KEY,
  TIME_SLOT_CLEANUP_DISMISS_STORAGE_KEY,
  isValidTimeSlot,
  getTimeSlotInfo,
  getTimeSlotForDate,
  getPastTimeSlots,
  TIME_SLOT_TIMES_CHANGED_EVENT,
} from '../constants/timeSlots.js'
import TodaySettingsModal from './today/TodaySettingsModal.jsx'
import {
  getCachedTodayViewSettings,
  loadTodayViewSettings,
  saveTodayViewSettings,
} from '../services/todayViewSettingsService.js'
import { openPomodoroForTask } from '../constants/pomodoro.js'

/** 섹션 표시 순서: 오전 → 오후 → 퇴근 후 → 언제든 */
const SECTION_ORDER = [...TIME_SLOTS.map((slot) => slot.key), UNASSIGNED_SLOT_KEY]


/**
 * 할 일 → 섹션 키 (시간대가 없으면 '언제든')
 * @param {Object} task
 * @returns {string}
 */
const getSectionKey = (task) => (isValidTimeSlot(task.timeSlot) ? task.timeSlot : UNASSIGNED_SLOT_KEY)

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
 * @param {{ appTheme?: string }} props
 */
export default function TodayView({ appTheme = APP_THEMES.POSILY }) {
  const [tasks, setTasks] = useState([])
  /** 완료 애니메이션 중인 할 일 ID (목록에서 유지) */
  const [completingTaskIds, setCompletingTaskIds] = useState(() => new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragStartIndexRef = useRef(null)
  /** 시간대별 보기 · 집중 모드 (캐시로 먼저 그리고, Supabase 값으로 갱신) */
  const [isSlotView, setIsSlotView] = useState(() => getCachedTodayViewSettings().isSlotView)
  const [isFocusMode, setIsFocusMode] = useState(() => getCachedTodayViewSettings().isFocusMode)
  /** 지난 시간대에 못 끝낸 할 일을 지금 시간대로 자동 이월 */
  const [isAutoCarry, setIsAutoCarry] = useState(() => getCachedTodayViewSettings().isAutoCarry)
  const autoCarryInFlightRef = useRef(false)
  /** 현재 시각 (1분마다 갱신해 시간대 전환 반영) */
  const [now, setNow] = useState(() => Date.now())
  /** 사용자가 직접 펼치거나 접은 섹션 { [sectionKey]: boolean(접힘) } */
  const [collapsedOverrides, setCollapsedOverrides] = useState({})
  /** 시간대 섹션 드래그 오버 위치 'slotKey:index' */
  const [slotDragOverKey, setSlotDragOverKey] = useState(null)
  const [cleanupDismissedKey, setCleanupDismissedKey] = useState(() => {
    try {
      return localStorage.getItem(TIME_SLOT_CLEANUP_DISMISS_STORAGE_KEY) || ''
    } catch {
      return ''
    }
  })
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

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
      // 예약된 날짜가 오늘인 항목들을 오늘 할일로 자동 이동
      await moveScheduledTasksToToday()
      await applyDailyRoutinesToToday()
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
    
    // 자정에 자동으로 백로그로 이동하는 타이머 설정
    const setupMidnightTimer = () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0) // 다음날 자정
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime()
      
      const midnightTimer = setTimeout(async () => {
        // 자정이 되면 오늘 할일을 백로그로 이동
        try {
          await checkAndResetIfNeeded()
          await moveScheduledTasksToToday()
          await applyDailyRoutinesToToday()
          await loadTasks()
          showToast('새로운 하루가 시작되었습니다! 오늘 할일이 업데이트되었습니다.', TOAST_TYPES.INFO)
          
          // 다음 자정을 위한 타이머 재설정
          setupMidnightTimer()
        } catch (error) {
          console.error('자정 자동 리셋 오류:', error)
        }
      }, msUntilMidnight)
      
      return midnightTimer
    }
    
    const midnightTimer = setupMidnightTimer()
    
    return () => {
      window.removeEventListener('refreshTodayTasks', handleRefreshTasks)
      if (midnightTimer) {
        clearTimeout(midnightTimer)
      }
    }
  }, [])

  /**
   * 완료 애니메이션 시작 (카드는 목록에 유지, 완료 숫자만 즉시 반영)
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
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === updatedTask.id)
      if (exists) {
        return prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      }
      return [...prev, updatedTask]
    })
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
      showToast('백로그로 이동했습니다!', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error.message || '이동에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const completedCount =
    tasks.filter((t) => t.completed).length + completingTaskIds.size
  const totalTodayCount = tasks.length

  /**
   * 미완료 + 완료 애니메이션 중인 할 일 표시
   */
  const incompleteTasks = tasks
    .filter((task) => !task.completed || completingTaskIds.has(task.id))
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

  // ───────────── 시간대별 보기 ─────────────

  // 1분마다 현재 시각 갱신 (오전 → 오후 전환 등 반영)
  // 시간대 시작 시각을 바꾸면 즉시 다시 계산
  useEffect(() => {
    const refreshNow = () => setNow(Date.now())
    const timer = window.setInterval(refreshNow, 60 * 1000)
    window.addEventListener(TIME_SLOT_TIMES_CHANGED_EVENT, refreshNow)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener(TIME_SLOT_TIMES_CHANGED_EVENT, refreshNow)
    }
  }, [])

  // Supabase에 저장된 보기 설정 불러오기 (다른 기기에서 바꾼 값 반영)
  useEffect(() => {
    let cancelled = false
    loadTodayViewSettings().then((settings) => {
      if (cancelled) return
      setIsSlotView(settings.isSlotView)
      setIsFocusMode(settings.isFocusMode)
      setIsAutoCarry(settings.isAutoCarry)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * 보기 설정 팝업 저장: Supabase에 저장한 뒤 화면에 반영
   * 시간대 시작 시각은 서비스가 캐시를 갱신하며 변경 이벤트로 반영됨
   */
  const handleSaveViewSettings = async (settings) => {
    await saveTodayViewSettings(settings)
    setIsSlotView(settings.isSlotView)
    setIsFocusMode(settings.isFocusMode)
    setIsAutoCarry(settings.isAutoCarry)
  }

  const currentSlotKey = getTimeSlotForDate(now)
  const pastSlotKeys = getPastTimeSlots(currentSlotKey, now)
  const todayDateString = getTodayDateString()

  /** 섹션별 미완료 할 일 (핵심 할 일을 섹션 맨 위로) */
  const tasksBySection = Object.fromEntries(SECTION_ORDER.map((key) => [key, []]))
  incompleteTasks.forEach((task) => {
    tasksBySection[getSectionKey(task)].push(task)
  })
  SECTION_ORDER.forEach((key) => {
    // Array.prototype.sort는 안정 정렬이라 같은 그룹 안에서는 priority 순서가 유지됨
    tasksBySection[key].sort((a, b) => Number(!!b.isKey) - Number(!!a.isKey))
  })

  /** 섹션별 완료 개수 (애니메이션 중인 항목은 미완료 쪽에서 이미 셈) */
  const completedCountBySection = Object.fromEntries(SECTION_ORDER.map((key) => [key, 0]))
  tasks.forEach((task) => {
    if (task.completed && !completingTaskIds.has(task.id)) {
      completedCountBySection[getSectionKey(task)] += 1
    }
  })

  /** 집중 모드면 지금 시간대 + 언제든만 표시 */
  const visibleSectionKeys = isFocusMode
    ? SECTION_ORDER.filter((key) => key === currentSlotKey || key === UNASSIGNED_SLOT_KEY)
    : SECTION_ORDER

  /** 지난 시간대는 기본 접힘, 사용자가 바꾼 상태가 있으면 그걸 따름 */
  const isSectionCollapsed = (key) =>
    key in collapsedOverrides ? collapsedOverrides[key] : pastSlotKeys.includes(key)

  const toggleSectionCollapse = (key) => {
    setCollapsedOverrides((prev) => ({ ...prev, [key]: !isSectionCollapsed(key) }))
  }

  /** 지난 시간대에 남은 할 일 (정리 배너용) */
  const leftoverTasks = pastSlotKeys.flatMap((key) =>
    tasksBySection[key].filter((task) => !completingTaskIds.has(task.id)),
  )
  const leftoverSlotLabels = pastSlotKeys
    .filter((key) => tasksBySection[key].length > 0)
    .map((key) => getTimeSlotInfo(key).label)
  // 같은 날 같은 시간대에서 한 번 닫으면 다시 띄우지 않음
  const cleanupKey = `${todayDateString}|${currentSlotKey}`
  // 자동 이월이 켜져 있으면 배너 대신 바로 옮김
  const showCleanupBanner =
    isSlotView && !isAutoCarry && leftoverTasks.length > 0 && cleanupDismissedKey !== cleanupKey

  /**
   * 자동 이월: 지난 시간대에 남은 할 일을 지금 시간대로 옮김
   * 시간대가 바뀌거나(1분마다 확인) 지난 시간대에 할 일이 생기면 실행
   * 오전 시작 전 새벽에는 지난 시간대가 없어 실행되지 않음
   */
  const leftoverIdsKey = leftoverTasks.map((task) => task.id).join(',')
  useEffect(() => {
    if (!isSlotView || !isAutoCarry || isLoading || !leftoverIdsKey) return
    if (autoCarryInFlightRef.current) return

    const ids = leftoverIdsKey.split(',')
    const targetSlotKey = currentSlotKey
    autoCarryInFlightRef.current = true
    moveTasksToTimeSlot(ids, targetSlotKey)
      .then(() => {
        setTasks((prev) =>
          prev.map((task) => (ids.includes(task.id) ? { ...task, timeSlot: targetSlotKey } : task)),
        )
        const slot = getTimeSlotInfo(targetSlotKey)
        showToast(`⏭️ 못 끝낸 할 일 ${ids.length}개를 ${slot.emoji} ${slot.label}로 옮겼어요.`, TOAST_TYPES.INFO)
      })
      .catch((error) => {
        console.error('자동 이월 오류:', error)
      })
      .finally(() => {
        autoCarryInFlightRef.current = false
      })
  }, [isSlotView, isAutoCarry, isLoading, leftoverIdsKey, currentSlotKey])

  const dismissCleanupBanner = () => {
    setCleanupDismissedKey(cleanupKey)
    try {
      localStorage.setItem(TIME_SLOT_CLEANUP_DISMISS_STORAGE_KEY, cleanupKey)
    } catch {
      // 무시
    }
  }

  /**
   * 지난 시간대 할 일을 지금 시간대로 미루기
   */
  const handleMoveLeftoversToCurrent = async () => {
    const ids = leftoverTasks.map((task) => task.id)
    setIsCleaningUp(true)
    try {
      await moveTasksToTimeSlot(ids, currentSlotKey)
      setTasks((prev) =>
        prev.map((task) => (ids.includes(task.id) ? { ...task, timeSlot: currentSlotKey } : task)),
      )
      showToast(`${ids.length}개를 ${getTimeSlotInfo(currentSlotKey).label}로 미뤘어요.`, TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error.message || '시간대 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsCleaningUp(false)
    }
  }

  /**
   * 지난 시간대 할 일을 백로그로 보내기
   */
  const handleMoveLeftoversToBacklog = async () => {
    const ids = leftoverTasks.map((task) => task.id)
    setIsCleaningUp(true)
    try {
      await moveTasksToBacklog(ids)
      setTasks((prev) => prev.filter((task) => !ids.includes(task.id)))
      showToast(`${ids.length}개를 백로그로 보냈어요.`, TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error.message || '백로그 이동에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsCleaningUp(false)
    }
  }

  /**
   * 시간대 섹션 드래그 오버 (index === 섹션 길이면 섹션 맨 끝)
   */
  const handleSlotDragOver = (e, sectionKey, index) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setSlotDragOverKey(`${sectionKey}:${index}`)
  }

  /**
   * 시간대 섹션 드롭: 섹션 안 순서 변경 또는 다른 시간대로 이동
   */
  const handleSlotDrop = async (e, targetSectionKey, dropIndex) => {
    e.preventDefault()
    e.stopPropagation()
    setSlotDragOverKey(null)

    const draggedId = draggedTaskId
    setDraggedTaskId(null)
    dragStartIndexRef.current = null
    if (!draggedId) return

    const sections = Object.fromEntries(
      SECTION_ORDER.map((key) => [key, [...tasksBySection[key]]]),
    )
    const sourceSectionKey = SECTION_ORDER.find((key) =>
      sections[key].some((task) => task.id === draggedId),
    )
    if (!sourceSectionKey) return

    const sourceIndex = sections[sourceSectionKey].findIndex((task) => task.id === draggedId)
    if (sourceSectionKey === targetSectionKey && sourceIndex === dropIndex) return

    const [draggedTask] = sections[sourceSectionKey].splice(sourceIndex, 1)
    const targetList = sections[targetSectionKey]
    targetList.splice(Math.min(dropIndex, targetList.length), 0, draggedTask)

    const nextTimeSlot = targetSectionKey === UNASSIGNED_SLOT_KEY ? null : targetSectionKey
    const isSlotChanged = sourceSectionKey !== targetSectionKey

    // 섹션 순서대로 이어 붙여 priority를 0부터 다시 매김
    const ordered = SECTION_ORDER.flatMap((key) => sections[key])
    const priorityUpdates = ordered.map((task, index) => ({
      id: task.id,
      priority: index,
      ...(isSlotChanged && task.id === draggedId ? { timeSlot: nextTimeSlot } : {}),
    }))

    const updatedById = new Map(
      priorityUpdates.map((update) => [
        update.id,
        'timeSlot' in update ? { priority: update.priority, timeSlot: update.timeSlot } : { priority: update.priority },
      ]),
    )
    setTasks((prev) =>
      prev.map((task) => (updatedById.has(task.id) ? { ...task, ...updatedById.get(task.id) } : task)),
    )

    try {
      await updateTaskPriorities(priorityUpdates)
    } catch (error) {
      console.error('시간대 이동 오류:', error)
      loadTasks()
    }
  }

  /**
   * 할 일 하나 렌더 (시간대 섹션용)
   */
  const renderSlotTask = (sectionKey) => (task, index) => (
    <div
      key={task.id}
      draggable
      onDragStart={(e) => handleDragStart(e, task.id, index)}
      onDragOver={(e) => handleSlotDragOver(e, sectionKey, index)}
      onDrop={(e) => handleSlotDrop(e, sectionKey, index)}
      onDragEnd={() => {
        handleDragEnd()
        setSlotDragOverKey(null)
      }}
      className={`transition-all duration-200 ${
        draggedTaskId === task.id
          ? 'opacity-50'
          : slotDragOverKey === `${sectionKey}:${index}`
          ? 'transform translate-y-1'
          : ''
      }`}
    >
      <TaskItem
        task={task}
        onUpdate={handleTaskUpdate}
        onCompleteAnimationStart={handleCompleteAnimationStart}
        onDelete={handleTaskDelete}
        onMoveToBacklog={() => handleMoveToBacklog(task.id)}
        onStartPomodoro={() => openPomodoroForTask(task)}
        showQuickTimeSlot={sectionKey === UNASSIGNED_SLOT_KEY}
      />
    </div>
  )

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
      {shouldShowTodayExcelGrid(appTheme) && (
        <div className="fixed inset-0 -z-10 excel-grid-bg" />
      )}

      <div className={`max-w-2xl mx-auto p-6 ${appTheme === APP_THEMES.EXCEL ? 'today-view--excel' : ''}`}>
        <ViewPageTitle iconSrc={MENU_ICON_PATHS.today} title="오늘 할 일">
          <p className="text-lg text-white mb-2">
            {getCurrentDateString()}
          </p>
          <p className="text-xl text-white">
            {totalTodayCount > 0
              ? `${completedCount}개 완료 / ${totalTodayCount}개`
              : '오늘은 무엇을 할까요?'}
          </p>
        </ViewPageTitle>

        {/* 1년 전 오늘 일기 (있을 때만) */}
        <DiaryMemoryCard />

        {/* 보기 설정 팝업 열기 + 현재 보기 상태 */}
        <div className="mb-4 flex items-center justify-end gap-2">
          {isSlotView && (
            <span className="text-sm text-gray-700 bg-white/70 rounded-full px-3 py-1 shadow-sm">
              {isFocusMode ? '🎯 지금만' : '🕒 시간대별'} · 지금{' '}
              {getTimeSlotInfo(currentSlotKey).emoji} {getTimeSlotInfo(currentSlotKey).label}
              {isAutoCarry && ' · ⏭️ 자동 이월'}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="px-3 py-1.5 rounded-full text-sm font-semibold shadow-sm bg-white/80 text-gray-700 hover:bg-white"
            aria-haspopup="dialog"
          >
            ⚙️ 보기 설정
          </button>
        </div>

        {isSettingsModalOpen && (
          <TodaySettingsModal
            isSlotView={isSlotView}
            isFocusMode={isFocusMode}
            isAutoCarry={isAutoCarry}
            onSave={handleSaveViewSettings}
            onClose={() => setIsSettingsModalOpen(false)}
          />
        )}

        {/* 지난 시간대 정리 배너 */}
        {!isLoading && showCleanupBanner && (
          <TimeSlotCleanupBanner
            pastLabels={leftoverSlotLabels}
            count={leftoverTasks.length}
            currentSlot={getTimeSlotInfo(currentSlotKey)}
            isWorking={isCleaningUp}
            onMoveToCurrent={handleMoveLeftoversToCurrent}
            onMoveToBacklog={handleMoveLeftoversToBacklog}
            onDismiss={dismissCleanupBanner}
          />
        )}

        {/* 할 일 목록 */}
        {isLoading ? (
          <div className="text-center py-8 text-gray-500 text-xl">로딩 중...</div>
        ) : isSlotView && totalTodayCount > 0 ? (
          <div className="space-y-4">
            {visibleSectionKeys.map((key) => {
              const sectionTasks = tasksBySection[key]
              // 집중 모드에서 '언제든' 섹션이 비어 있으면 숨김
              if (isFocusMode && key === UNASSIGNED_SLOT_KEY && sectionTasks.length === 0) {
                return null
              }
              // 시간대 미지정 섹션은 할 일이 없으면 숨김
              if (
                key === UNASSIGNED_SLOT_KEY &&
                sectionTasks.length === 0 &&
                completedCountBySection[key] === 0
              ) {
                return null
              }
              return (
                <TimeSlotSection
                  key={key}
                  slot={key === UNASSIGNED_SLOT_KEY ? UNASSIGNED_SLOT : getTimeSlotInfo(key)}
                  tasks={sectionTasks}
                  completedCount={completedCountBySection[key]}
                  isCurrent={key === currentSlotKey}
                  isPast={pastSlotKeys.includes(key)}
                  isCollapsed={isSectionCollapsed(key)}
                  onToggleCollapse={() => toggleSectionCollapse(key)}
                  isDropTarget={!!draggedTaskId && slotDragOverKey === `${key}:${sectionTasks.length}`}
                  onDragOverEnd={(e) => handleSlotDragOver(e, key, sectionTasks.length)}
                  onDropEnd={(e) => handleSlotDrop(e, key, sectionTasks.length)}
                  renderTask={renderSlotTask(key)}
                />
              )
            })}
          </div>
        ) : incompleteTasks.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xl">
            {totalTodayCount === 0
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
                  onCompleteAnimationStart={handleCompleteAnimationStart}
                  onDelete={handleTaskDelete}
                  onMoveToBacklog={() => handleMoveToBacklog(task.id)}
                  onStartPomodoro={() => openPomodoroForTask(task)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

    </>
  )
}

