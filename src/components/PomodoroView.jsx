import { useEffect, useRef, useState } from 'react'
import { showToast, TOAST_TYPES } from './Toast.jsx'
import TimerBgmToggle from './TimerBgmToggle.jsx'
import { useTimerBgm } from '../hooks/useTimerBgm.js'
import { addStudySession, formatStudyDuration } from '../services/studyTimeService.js'

const DURATIONS = [15, 25, 35, 50]

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
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60)
  // 'idle' | 'running' | 'paused' | 'finished'
  const [state, setState] = useState('idle')
  const [isSaving, setIsSaving] = useState(false)
  const [imgSize, setImgSize] = useState(280)
  const imgContainerRef = useRef(null)
  const intervalRef = useRef(null)
  const endTimeRef = useRef(null) // Date.now() + ms
  const { enabled: bgmEnabled, toggle: toggleBgm } = useTimerBgm()

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
    if (state === 'idle' || state === 'finished') {
      setSelectedMinutes(min)
      setRemainingSeconds(min * 60)
      setState('idle')
    }
  }

  const handleStart = () => {
    if (state === 'paused') {
      endTimeRef.current = Date.now() + remainingSeconds * 1000
    } else {
      const secs = selectedMinutes * 60
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
      await addStudySession(secs, { source: 'pomodoro' })
      showToast(`${formatStudyDuration(secs)} 기록 완료!`, TOAST_TYPES.SUCCESS)
      setState('idle')
      setRemainingSeconds(selectedMinutes * 60)
    } catch (err) {
      showToast(err.message || '저장 실패', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
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
            src="/images/타이머.png"
            alt="포실이 타이머"
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
      </div>

      {/* 시간 선택 */}
      <div className="mt-5 flex gap-2 px-6">
        {DURATIONS.map((min) => {
          const isSelected = selectedMinutes === min
          const disabled = state === 'running' || state === 'paused'
          return (
            <button
              key={min}
              type="button"
              onClick={() => handleSelectDuration(min)}
              disabled={disabled}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
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
      </div>

      <p className="mt-3 text-xs text-gray-400 text-center px-6">
        완료 후 기록 저장하면 공부 통계에 쌓여요
      </p>
    </div>
  )
}