import { useEffect, useRef, useState } from 'react'
import { showToast, TOAST_TYPES } from './Toast.jsx'
import {
  addStudySession,
  formatStudyDuration,
} from '../services/studyTimeService.js'

const WEEKDAY_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

function formatClockParts(date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = WEEKDAY_KO[date.getDay()]
  return {
    time: `${hours}:${minutes}`,
    dateLabel: `${month}월 ${day}일 ${weekday}`,
  }
}

function formatTimer(totalSeconds) {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec % 3600) / 60)
  const seconds = sec % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * 여름.png 배경 시계 + 공부 타이머
 */
function SummerClockView({ onClose }) {
  const [now, setNow] = useState(() => new Date())
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false)
  const [isTimerVisible, setIsTimerVisible] = useState(false)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (isTimerRunning) {
      intervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    } else if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isTimerRunning])

  useEffect(() => {
    const syncFullscreen = () => {
      setIsBrowserFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        onClose?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const { time, dateLabel } = formatClockParts(now)

  const toggleBrowserFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // ignore
    }
  }

  const handleClose = async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch {
        // ignore
      }
    }
    onClose?.()
  }

  const handleResetTimer = () => {
    setIsTimerRunning(false)
    setElapsedSeconds(0)
  }

  const handleOpenTimer = () => {
    setIsTimerVisible(true)
  }

  const handleHideTimer = () => {
    setIsTimerRunning(false)
    setIsTimerVisible(false)
  }

  const handleCompleteStudy = async () => {
    if (elapsedSeconds <= 0 || isSaving) return
    setIsTimerRunning(false)
    setIsSaving(true)
    try {
      await addStudySession(elapsedSeconds, { source: 'summer-clock' })
      showToast(
        `오늘 공부 ${formatStudyDuration(elapsedSeconds)} 기록했어요`,
        TOAST_TYPES.SUCCESS,
      )
      setElapsedSeconds(0)
      window.dispatchEvent(new CustomEvent('refreshStudyTime'))
    } catch (error) {
      showToast(error.message || '공부 시간 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-[#cfe8d8]">
      <img
        src="/images/여름.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center select-none pointer-events-none"
        draggable={false}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20 pointer-events-none" />

      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-full bg-white/55 px-4 py-2 text-sm font-medium text-gray-800 shadow-sm backdrop-blur-md transition hover:bg-white/75"
        >
          ← 나가기
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isTimerVisible ? handleHideTimer : handleOpenTimer}
            className={`rounded-full px-4 py-2 text-sm font-medium shadow-sm backdrop-blur-md transition ${
              isTimerVisible
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-white/55 text-gray-800 hover:bg-white/75'
            }`}
          >
            {isTimerVisible ? '타이머 닫기' : '타이머'}
          </button>
          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="rounded-full bg-white/55 px-4 py-2 text-sm font-medium text-gray-800 shadow-sm backdrop-blur-md transition hover:bg-white/75"
          >
            {isBrowserFullscreen ? '전체화면 해제' : '전체화면'}
          </button>
        </div>
      </div>

      <div className="relative z-[1] flex h-full flex-col items-center pt-[10vh] px-6 text-center">
        <p
          className="mb-2 text-lg font-medium tracking-wide text-gray-800/80 sm:text-xl"
          style={{ textShadow: '0 1px 8px rgba(255,255,255,0.55)' }}
        >
          {dateLabel}
        </p>
        <p
          className="font-semibold leading-none tracking-tight text-gray-900 tabular-nums"
          style={{
            fontSize: 'clamp(4rem, 16vw, 8.5rem)',
            textShadow: '0 2px 24px rgba(255,255,255,0.45), 0 1px 2px rgba(0,0,0,0.12)',
            fontFamily: '"Avenir Next", "Nunito", "Segoe UI", system-ui, sans-serif',
          }}
        >
          {time}
        </p>

        {isTimerVisible && (
          <div className="mt-8 sm:mt-10 w-full max-w-md rounded-3xl bg-white/50 px-5 py-5 shadow-lg backdrop-blur-md border border-white/60 animate-[fadeIn_0.2s_ease-out]">
            <p className="text-sm font-semibold text-gray-700 mb-2">공부 타이머</p>
            <p className="text-4xl sm:text-5xl font-bold tabular-nums text-emerald-800 tracking-tight">
              {formatTimer(elapsedSeconds)}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsTimerRunning((v) => !v)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition ${
                  isTimerRunning
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isTimerRunning ? '일시정지' : '시작'}
              </button>
              <button
                type="button"
                onClick={handleResetTimer}
                className="rounded-full bg-white/80 px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-white"
              >
                리셋
              </button>
              {elapsedSeconds > 0 && (
                <button
                  type="button"
                  onClick={handleCompleteStudy}
                  disabled={isSaving}
                  className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
                >
                  {isSaving ? '저장 중...' : '완료'}
                </button>
              )}
            </div>
            <p className="mt-3 text-xs text-gray-600">
              완료하면 할 일 달력에 오늘 총 공부량으로 쌓여요
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SummerClockView
