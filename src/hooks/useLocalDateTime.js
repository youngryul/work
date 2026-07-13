import { useEffect, useState } from 'react'

/**
 * 특정 타임존의 현재 날짜·시각을 1초마다 갱신
 * @param {string} timeZone IANA timezone
 */
export function useLocalDateTime(timeZone) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const tz = timeZone || 'UTC'

  const dateLabel = new Intl.DateTimeFormat('ko-KR', {
    timeZone: tz,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(now)

  const timeLabel = new Intl.DateTimeFormat('ko-KR', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)

  return { now, dateLabel, timeLabel, timeZone: tz }
}
