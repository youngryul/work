import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TIMER_BGM_DEFAULT_VOLUME,
  TIMER_BGM_PUBLIC_PATH,
} from '../constants/timerBgm.js'

/**
 * 타이머 배경음악 — on/off만으로 재생/정지, 무한 반복
 * (시작/일시정지와 무관)
 */
export function useTimerBgm() {
  // 항상 OFF로 시작 → ON 클릭(사용자 제스처)에서만 재생
  const [enabled, setEnabled] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => {
    const audio = new Audio(TIMER_BGM_PUBLIC_PATH)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = TIMER_BGM_DEFAULT_VOLUME
    audioRef.current = audio

    return () => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
    }
  }, [])

  const playBgm = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return
    try {
      audio.loop = true
      await audio.play()
    } catch (error) {
      console.warn('[timer-bgm] 재생 실패:', error?.message || error)
    }
  }, [])

  const pauseBgm = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
  }, [])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      queueMicrotask(() => {
        if (next) {
          playBgm()
        } else {
          pauseBgm()
        }
      })
      return next
    })
  }, [playBgm, pauseBgm])

  return { enabled, toggle }
}
