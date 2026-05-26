import { useCallback, useEffect, useState } from 'react'
import { getMyAiTokenInfo } from '../services/aiTokenService.js'
import { AI_TOKEN_UPDATED_EVENT } from '../utils/aiTokenEvents.js'

/**
 * AI 토큰 보유량·생성 비용 (변동 시 자동 새로고침)
 * @param {unknown} [refreshDep] - 추가 새로고침 트리거
 * @returns {{ balance: number | null, generationCost: number, isLoading: boolean, reload: () => Promise<void> }}
 */
export function useAiTokenInfo(refreshDep) {
  const [balance, setBalance] = useState(null)
  const [generationCost, setGenerationCost] = useState(3)
  const [isLoading, setIsLoading] = useState(true)

  const applyInfo = useCallback((info) => {
    setBalance(info.balance)
    setGenerationCost(info.generationCost)
  }, [])

  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      const info = await getMyAiTokenInfo()
      applyInfo(info)
    } catch {
      // 폴백은 getMyAiTokenInfo 내부 처리
    } finally {
      setIsLoading(false)
    }
  }, [applyInfo])

  useEffect(() => {
    reload()
  }, [reload, refreshDep])

  useEffect(() => {
    const handleUpdate = (event) => {
      const { balance: nextBalance, generationCost: nextCost } = event.detail || {}
      if (typeof nextBalance === 'number') {
        setBalance(nextBalance)
      } else {
        reload()
      }
      if (typeof nextCost === 'number') {
        setGenerationCost(nextCost)
      }
    }

    window.addEventListener(AI_TOKEN_UPDATED_EVENT, handleUpdate)
    return () => window.removeEventListener(AI_TOKEN_UPDATED_EVENT, handleUpdate)
  }, [reload])

  return { balance, generationCost, isLoading, reload }
}
