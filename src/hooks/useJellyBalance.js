import { useCallback, useEffect, useState } from 'react'
import { getMyJellyBalance } from '../services/jellyService.js'
import { JELLY_UPDATED_EVENT } from '../utils/jellyEvents.js'

/**
 * 젤리 보유량 (변동 시 자동 새로고침)
 * @param {unknown} [refreshDep]
 * @returns {{ balance: number | null, isLoading: boolean, reload: () => Promise<void> }}
 */
export function useJellyBalance(refreshDep) {
  const [balance, setBalance] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      const value = await getMyJellyBalance()
      setBalance(value)
    } catch {
      setBalance(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload, refreshDep])

  useEffect(() => {
    const handleUpdate = (event) => {
      const { balance: nextBalance } = event.detail || {}
      if (typeof nextBalance === 'number') {
        setBalance(nextBalance)
      } else {
        reload()
      }
    }

    window.addEventListener(JELLY_UPDATED_EVENT, handleUpdate)
    return () => window.removeEventListener(JELLY_UPDATED_EVENT, handleUpdate)
  }, [reload])

  return { balance, isLoading, reload }
}
