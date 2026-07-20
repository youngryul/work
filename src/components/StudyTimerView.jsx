import { useEffect, useRef, useState } from 'react'
import { showToast, TOAST_TYPES } from './Toast.jsx'
import { addStudySession, formatStudyDuration } from '../services/studyTimeService.js'

function formatElapsed(totalSeconds) {
  const sec = Math.max(0, totalSeconds)
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * 포실이 공부 타이머 (스톱워치 방식 — 경과 시간 측정)
 */
export default function StudyTimerView({ onClose }) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const startTimeRef = useRef(null) // 타이머 시작 시각 (ms)
  const baseSecondsRef = useRef(0)  // 일시정지 전까지 누적 초
  const intervalRef = useRef(null)

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now()
      intervalRef.current = window.setInterval(() => {
        const elapsed = baseSecondsRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000)
        setElapsedSeconds(elapsed)
      }, 200)
    } else {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      // 일시정지 시점의 경과 시간 저장
      if (startTimeRef.current !== null) {
        baseSecondsRef.current += Math.floor((Date.now() - startTimeRef.current) / 1000)
        startTimeRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isRunning])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleReset = () => {
    setIsRunning(false)
    setElapsedSeconds(0)
    baseSecondsRef.current = 0
    startTimeRef.current = null
  }

  const handleSave = async () => {
    if (elapsedSeconds <= 0 || isSaving) return
    setIsRunning(false)
    const secs = elapsedSeconds
    setIsSaving(true)
    try {
      await addStudySession(secs, { source: 'study-timer' })
      showToast(`${formatStudyDuration(secs)} 기록 완료!`, TOAST_TYPES.SUCCESS)
      handleReset()
    } catch (err) {
      showToast(err.message || '저장 실패', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  const statusText = isRunning
    ? '포실이와 함께 집중 중...'
    : elapsedSeconds > 0
    ? '일시정지됨'
    : '시작 버튼을 눌러보세요'

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
          className="rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm backdrop-blur-md hover:bg-white/90 transition"
        >
          ← 나가기
        </button>
        <h1 className="text-base font-semibold text-gray-700">공부 타이머</h1>
        <div className="w-20" />
      </div>

      {/* 포실이 이미지 */}
      <div className="mt-4 px-6 w-full max-w-xs">
        <div
          className="relative mx-auto rounded-2xl overflow-hidden shadow-lg"
          style={{ width: '100%', aspectRatio: '1/1', maxWidth: 300 }}
        >
          <img
            src="/images/타이머.png"
            alt="포실이 타이머"
            className="w-full h-full object-cover select-none"
            draggable={false}
          />
          {/* 실행 중이 아닐 때 살짝 어두운 오버레이 */}
          {!isRunning && (
            <div className="absolute inset-0 bg-white/40 transition-opacity duration-500" />
          )}
        </div>
      </div>

      {/* 경과 시간 */}
      <div className="mt-6 text-center">
        <p
          className="font-semibold tabular-nums tracking-tight text-gray-800"
          style={{ fontSize: 'clamp(3rem, 15vw, 5rem)' }}
        >
          {formatElapsed(elapsedSeconds)}
        </p>
        <p className="mt-1 text-sm text-gray-500">{statusText}</p>
      </div>

      {/* 컨트롤 버튼 */}
      <div className="mt-5 flex gap-3 px-6 w-full max-w-sm">
        <button
          type="button"
          onClick={handleReset}
          className="flex-1 rounded-xl bg-white/70 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-white transition"
        >
          초기화
        </button>

        <button
          type="button"
          onClick={() => setIsRunning((v) => !v)}
          className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white shadow-sm transition ${
            isRunning
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isRunning ? '일시정지' : elapsedSeconds > 0 ? '재개' : '시작'}
        </button>

        {elapsedSeconds > 0 && !isRunning && (
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

      <p className="mt-3 text-xs text-gray-400 text-center px-6">
        완료 후 기록 저장하면 공부 통계에 쌓여요
      </p>
    </div>
  )
}
