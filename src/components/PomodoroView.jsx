import { useEffect, useRef, useState } from 'react'
import { showToast, TOAST_TYPES } from './Toast.jsx'
import TimerBgmToggle from './TimerBgmToggle.jsx'
import { useTimerBgm } from '../hooks/useTimerBgm.js'
import { addStudySession, formatStudyDuration, POMODORO_SOURCE } from '../services/studyTimeService.js'
import StudyTimerCategoryPicker from './StudyTimerCategoryPicker.jsx'
import { DEFAULT_STUDY_TIMER_CATEGORY } from '../constants/studyTimerCategories.js'
import { readPomodoroLinkedTask, clearPomodoroLinkedTask } from '../constants/pomodoro.js'
import { updateTask } from '../services/taskService.js'
import PomodoroSummaryCard from './PomodoroSummaryCard.jsx'

const DURATIONS = [15, 25, 35, 50]
const MIN_POMODORO_MINUTES = 1
const MAX_POMODORO_MINUTES = 180

function clampPomodoroMinutes(value) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return 25
  return Math.min(MAX_POMODORO_MINUTES, Math.max(MIN_POMODORO_MINUTES, n))
}

function formatCountdown(totalSeconds) {
  const sec = Math.max(0, totalSeconds)
  const minutes = Math.floor(sec / 60)
  const seconds = sec % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * 시계방향으로 채워지는 마스크 SVG (포실이 이미지 위에 겹쳐 쓰는 흰색 오버레이)
 * progress: 0 ~ 1 (1이면 완전히 가림 → 0으로 갈수록 포실이가 드러남)
 */
function ClockwiseMask({ progress, size }) {
  if (progress <= 0) return null

  const cx = size / 2
  const cy = size / 2
  const r = size * 0.8 // 넉넉하게

  // -90° (12시) 부터 시계방향으로 progress * 360°
  const startAngle = -Math.PI / 2
  const endAngle = startAngle + 2 * Math.PI * progress

  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const largeArc = progress > 0.5 ? 1 : 0

  const d =
    progress >= 1
      ? `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r} ${r} 0 1 1 -${r * 2} 0`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={size}
      height={size}
      style={{ opacity: 0.88 }}
    >
      <path d={d} fill="white" />
    </svg>
  )
}

/**
 * 포실이 뽀모도로 타이머 뷰
 */
export default function PomodoroView({ onClose }) {
  const [selectedMinutes, setSelectedMinutes] = useState(25)
  const [minutesInput, setMinutesInput] = useState('25')
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60)
  // 'idle' | 'running' | 'paused' | 'finished'
  const [state, setState] = useState('idle')
  const [isSaving, setIsSaving] = useState(false)
  const [category, setCategory] = useState(DEFAULT_STUDY_TIMER_CATEGORY)
  const [imgSize, setImgSize] = useState(280)
  const imgContainerRef = useRef(null)
  const intervalRef = useRef(null)
  const endTimeRef = useRef(null) // Date.now() + ms
  const { enabled: bgmEnabled, toggle: toggleBgm } = useTimerBgm()
  // 오늘 할 일에서 🍅로 들어온 경우 연결된 할 일 (한 번만 꺼내 씀)
  const [linkedTask, setLinkedTask] = useState(() => readPomodoroLinkedTask())
  // 방금 기록한 연결 할 일 → "할 일도 완료" 버튼 표시용
  const [justSavedTask, setJustSavedTask] = useState(null)
  const [isCompletingTask, setIsCompletingTask] = useState(false)
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0)

  const canChangeDuration = state === 'idle' || state === 'finished'

  // 읽어 둔 연결 할 일은 저장소에서 지움 (메뉴로 다시 들어오면 연결 없이 시작)
  useEffect(() => {
    clearPomodoroLinkedTask()
  }, [])

  // 이미지 컨테이너 크기 측정
  useEffect(() => {
    function measure() {
      if (imgContainerRef.current) {
        const s = imgContainerRef.current.offsetWidth
        setImgSize(s)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // 타이머 틱
  useEffect(() => {
    if (state === 'running') {
      intervalRef.current = window.setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
        setRemainingSeconds(remaining)
        if (remaining <= 0) {
          setState('finished')
        }
      }, 100)
    } else {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [state])

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const totalSeconds = selectedMinutes * 60
  // 경과 시간 (완료 저장용)
  const elapsedSeconds = totalSeconds - remainingSeconds
  // 진행률: 0(시작) → 1(완료) → 포실이가 점점 드러남
  const progress = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0

  const handleSelectDuration = (min) => {
    if (!canChangeDuration) return
    const next = clampPomodoroMinutes(min)
    setSelectedMinutes(next)
    setMinutesInput(String(next))
    setRemainingSeconds(next * 60)
    setState('idle')
  }

  const handleMinutesInputChange = (event) => {
    if (!canChangeDuration) return
    const raw = event.target.value.replace(/\D/g, '')
    setMinutesInput(raw)
    if (raw === '') return
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed) || parsed < MIN_POMODORO_MINUTES) return
    const next = clampPomodoroMinutes(parsed)
    setSelectedMinutes(next)
    setRemainingSeconds(next * 60)
    setState('idle')
  }

  const handleMinutesInputBlur = () => {
    if (!canChangeDuration) {
      setMinutesInput(String(selectedMinutes))
      return
    }
    const next = clampPomodoroMinutes(minutesInput === '' ? selectedMinutes : minutesInput)
    setSelectedMinutes(next)
    setMinutesInput(String(next))
    setRemainingSeconds(next * 60)
    setState('idle')
  }

  const handleStart = () => {
    if (state === 'paused') {
      endTimeRef.current = Date.now() + remainingSeconds * 1000
    } else {
      const mins = clampPomodoroMinutes(selectedMinutes)
      setSelectedMinutes(mins)
      setMinutesInput(String(mins))
      const secs = mins * 60
      setRemainingSeconds(secs)
      endTimeRef.current = Date.now() + secs * 1000
    }
    setState('running')
  }

  const handlePause = () => {
    setState('paused')
  }

  const handleReset = () => {
    setState('idle')
    setRemainingSeconds(selectedMinutes * 60)
    endTimeRef.current = null
  }

  const handleSave = async () => {
    const secs = Math.max(elapsedSeconds, 0)
    if (secs <= 0 || isSaving) return
    setIsSaving(true)
    try {
      const result = await addStudySession(secs, {
        source: POMODORO_SOURCE,
        category,
        taskId: linkedTask?.id,
        taskTitle: linkedTask?.title,
      })
      const jellyMsg =
        result?.jellyAwarded > 0 ? ` · 젤리 +${result.jellyAwarded}` : ''
      showToast(`${formatStudyDuration(secs)} 기록 완료!${jellyMsg}`, TOAST_TYPES.SUCCESS)
      window.dispatchEvent(new CustomEvent('refreshStudyTime'))
      setSummaryRefreshKey((k) => k + 1)
      setJustSavedTask(linkedTask)
      setState('idle')
      setRemainingSeconds(selectedMinutes * 60)
    } catch (err) {
      showToast(err.message || '저장 실패', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * 방금 집중한 할 일을 완료 처리
   */
  const handleCompleteLinkedTask = async () => {
    if (!justSavedTask || isCompletingTask) return
    setIsCompletingTask(true)
    try {
      await updateTask(justSavedTask.id, { completed: true })
      showToast(`'${justSavedTask.title}' 완료! 🎉`, TOAST_TYPES.SUCCESS)
      window.dispatchEvent(new CustomEvent('refreshTodayTasks'))
      setJustSavedTask(null)
      setLinkedTask(null)
    } catch (err) {
      showToast(err.message || '할 일 완료 처리에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsCompletingTask(false)
    }
  }

  const statusText = {
    idle: '집중 시간을 선택하고 시작해보세요',
    running: '포실이와 함께 집중 중...',
    paused: '일시정지됨',
    finished: '수고했어요! 기록을 저장해보세요 🎉',
  }[state]

  return (
    <div
      className="fixed inset-0 z-[200] overflow-y-auto flex flex-col items-center"
      style={{ background: '#f5ede0' }}
    >
      {/* 상단 바 */}
      <div className="w-full flex items-center justify-between px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm backdrop-blur-md hover:bg-white/90 transition shrink-0"
        >
          ← 나가기
        </button>
        <h1 className="text-base font-semibold text-gray-700">뽀모도로</h1>
        <TimerBgmToggle enabled={bgmEnabled} onToggle={toggleBgm} className="shrink-0" />
      </div>

      {/* 포실이 이미지 + 마스크 */}
      <div className="mt-4 px-6 w-full max-w-xs">
        <div
          ref={imgContainerRef}
          className="relative mx-auto rounded-2xl overflow-hidden shadow-lg"
          style={{ width: '100%', aspectRatio: '1/1', maxWidth: 300 }}
        >
          <img
            src={`/images/${encodeURIComponent('포실이뽀모도로.png')}`}
            alt="포실이 뽀모도로"
            className="w-full h-full object-cover select-none"
            draggable={false}
          />
          {/* 흰색 마스크: 타이머 진행될수록 걷혀 포실이가 드러남 */}
          <ClockwiseMask progress={1 - progress} size={imgSize} />
        </div>
      </div>

      {/* 카운트다운 숫자 */}
      <div className="mt-6 text-center">
        <p
          className="font-semibold tabular-nums tracking-tight text-gray-800"
          style={{ fontSize: 'clamp(3rem, 15vw, 5rem)' }}
        >
          {formatCountdown(remainingSeconds)}
        </p>
        <p className="mt-1 text-sm text-gray-500">{statusText}</p>
        {linkedTask && (
          <div className="mt-3 mx-6 inline-flex max-w-xs items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 shadow-sm">
            <span className="text-sm text-gray-700 truncate">🎯 {linkedTask.title}</span>
            {(state === 'idle' || state === 'finished') && (
              <button
                type="button"
                onClick={() => setLinkedTask(null)}
                className="shrink-0 text-gray-400 hover:text-gray-600"
                aria-label="할 일 연결 해제"
              >
                ×
              </button>
            )}
          </div>
        )}
        <StudyTimerCategoryPicker
          value={category}
          onChange={setCategory}
          disabled={state === 'running' || state === 'paused'}
          className="mt-4 px-2"
        />
      </div>

      {/* 시간 선택 */}
      <div className="mt-5 flex flex-col gap-3 px-6 w-full max-w-sm">
        <div className="flex gap-2">
          {DURATIONS.map((min) => {
            const isSelected = selectedMinutes === min
            return (
              <button
                key={min}
                type="button"
                onClick={() => handleSelectDuration(min)}
                disabled={!canChangeDuration}
                className={`flex-1 min-w-0 rounded-xl px-1 py-2 text-sm font-semibold whitespace-nowrap tabular-nums transition ${
                  isSelected
                    ? 'bg-green-600 text-white shadow'
                    : 'bg-white/70 text-gray-700 hover:bg-white'
                } disabled:opacity-50`}
              >
                {min}분
              </button>
            )
          })}
        </div>
        <label className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 shadow-sm">
          <span className="text-sm font-medium text-gray-600 shrink-0">직접 입력</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={minutesInput}
            onChange={handleMinutesInputChange}
            onBlur={handleMinutesInputBlur}
            disabled={!canChangeDuration}
            aria-label="뽀모도로 분 입력"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-center text-sm font-semibold tabular-nums text-gray-800 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:opacity-50"
          />
          <span className="text-sm font-medium text-gray-600 shrink-0">분</span>
        </label>
        <p className="text-center text-[11px] text-gray-400">
          {MIN_POMODORO_MINUTES}~{MAX_POMODORO_MINUTES}분까지 입력할 수 있어요
        </p>
      </div>

      {/* 컨트롤 버튼 */}
      <div className="mt-4 flex gap-3 px-6 w-full max-w-sm">
        <button
          type="button"
          onClick={handleReset}
          className="flex-1 rounded-xl bg-white/70 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-white transition"
        >
          초기화
        </button>

        {state === 'finished' ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition disabled:opacity-60"
          >
            {isSaving ? '저장 중...' : '기록 저장'}
          </button>
        ) : state === 'running' ? (
          <button
            type="button"
            onClick={handlePause}
            className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition"
          >
            일시정지
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition"
          >
            {state === 'paused' ? '재개' : '시작'}
          </button>
        )}

        {state === 'paused' && elapsedSeconds > 0 && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition disabled:opacity-60"
          >
            {isSaving ? '저장 중...' : '완료'}
          </button>
        )}
      </div>

      {justSavedTask && (
        <div className="mt-3 px-6 w-full max-w-sm">
          <button
            type="button"
            onClick={handleCompleteLinkedTask}
            disabled={isCompletingTask}
            className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-green-700 shadow-sm hover:bg-green-50 transition disabled:opacity-60"
          >
            {isCompletingTask ? '처리 중...' : `✅ '${justSavedTask.title}' 할 일도 완료하기`}
          </button>
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400 text-center px-6">
        중간에 멈춰도 「완료」로 통계에 합산할 수 있어요
      </p>

      {/* 뽀모도로 합계 (할 일 달력에는 기록되지 않음) */}
      <div className="mt-5 mb-8 px-6 w-full max-w-sm">
        <PomodoroSummaryCard refreshKey={summaryRefreshKey} />
      </div>
    </div>
  )
}