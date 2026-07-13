import { useEffect, useState } from 'react'

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

/**
 * 여름.png 배경 위에 현재 시각을 크게 보여주는 전체 화면 시계
 */
function SummerClockView({ onClose }) {
  const [now, setNow] = useState(() => new Date())
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

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
      // 브라우저가 전체화면을 거부한 경우 무시
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

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-[#cfe8d8]">
      <img
        src="/images/여름.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center select-none pointer-events-none"
        draggable={false}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/15 pointer-events-none" />

      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleClose}
          className="rounded-full bg-white/55 px-4 py-2 text-sm font-medium text-gray-800 shadow-sm backdrop-blur-md transition hover:bg-white/75"
        >
          ← 나가기
        </button>
        <button
          type="button"
          onClick={toggleBrowserFullscreen}
          className="rounded-full bg-white/55 px-4 py-2 text-sm font-medium text-gray-800 shadow-sm backdrop-blur-md transition hover:bg-white/75"
        >
          {isBrowserFullscreen ? '전체화면 해제' : '전체화면'}
        </button>
      </div>

      <div className="relative z-[1] flex h-full flex-col items-center pt-[12vh] px-6 text-center">
        <p
          className="mb-2 text-lg font-medium tracking-wide text-gray-800/80 sm:text-xl"
          style={{ textShadow: '0 1px 8px rgba(255,255,255,0.55)' }}
        >
          {dateLabel}
        </p>
        <p
          className="font-semibold leading-none tracking-tight text-gray-900 tabular-nums"
          style={{
            fontSize: 'clamp(4.5rem, 18vw, 9.5rem)',
            textShadow: '0 2px 24px rgba(255,255,255,0.45), 0 1px 2px rgba(0,0,0,0.12)',
            fontFamily: '"Avenir Next", "Nunito", "Segoe UI", system-ui, sans-serif',
          }}
        >
          {time}
        </p>
      </div>
    </div>
  )
}

export default SummerClockView
