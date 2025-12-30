import { useState, useEffect, useRef } from 'react'

/**
 * 독서 타이머 컴포넌트
 */
export default function ReadingTimer({ onTimerStart, onTimerComplete, initialMinutes = 0 }) {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(initialMinutes * 60)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning])

  /**
   * 타이머 시작/일시정지
   */
  const toggleTimer = () => {
    const wasRunning = isRunning
    const willBeRunning = !isRunning
    setIsRunning(willBeRunning)
    
    // 시작 시 콜백 호출
    if (!wasRunning && willBeRunning) {
      onTimerStart?.()
    }
  }

  /**
   * 타이머 리셋
   */
  const resetTimer = () => {
    setIsRunning(false)
    setElapsedSeconds(0)
  }

  /**
   * 타이머 완료 처리
   */
  const handleComplete = () => {
    setIsRunning(false)
    onTimerComplete?.(elapsedSeconds)
  }

  // 시간 포맷팅 (HH:MM:SS)
  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h3 className="text-2xl font-bold text-gray-800 mb-4">독서 타이머</h3>
      
      {/* 타이머 표시 */}
      <div className="text-center mb-6">
        <div className="text-6xl font-bold text-blue-600 mb-2">
          {formatTime(elapsedSeconds)}
        </div>
        <div className="text-gray-600 text-lg">
          {hours > 0 ? `${hours}시간 ` : ''}{minutes}분
        </div>
      </div>

      {/* 컨트롤 버튼 */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={toggleTimer}
          className={`px-6 py-3 rounded-lg transition-colors duration-200 text-base font-medium ${
            isRunning
              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {isRunning ? '⏸ 일시정지' : '▶ 시작'}
        </button>
        <button
          type="button"
          onClick={resetTimer}
          className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 text-base font-medium"
        >
          🔄 리셋
        </button>
        {elapsedSeconds > 0 && (
          <button
            type="button"
            onClick={handleComplete}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-base font-medium"
          >
            ✓ 완료
          </button>
        )}
      </div>
    </div>
  )
}

