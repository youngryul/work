import { useCallback, useEffect, useState } from 'react'
import { getMyPosiliLoadout } from '../services/posiliDecorService.js'
import { EMPTY_POSILI_LOADOUT, POSILI_LOADOUT_UPDATED_EVENT } from '../constants/posiliDecor.js'

/**
 * 내 포실이 착용 상태 (다른 화면에서 바꾸면 자동 반영)
 * @returns {{ loadout: Record<string, { itemId: string, name: string, imageUrl: string } | null>, reload: () => Promise<void> }}
 */
export function usePosiliLoadout() {
  const [loadout, setLoadout] = useState(EMPTY_POSILI_LOADOUT)

  const reload = useCallback(async () => {
    try {
      setLoadout(await getMyPosiliLoadout())
    } catch {
      // 꾸미기 테이블이 아직 없거나 오류가 나도 기본 모습으로 보여준다
      setLoadout(EMPTY_POSILI_LOADOUT)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const handleUpdate = (event) => {
      const next = event.detail?.loadout
      if (next) setLoadout(next)
      else reload()
    }
    window.addEventListener(POSILI_LOADOUT_UPDATED_EVENT, handleUpdate)
    return () => window.removeEventListener(POSILI_LOADOUT_UPDATED_EVENT, handleUpdate)
  }, [reload])

  return { loadout, reload }
}
