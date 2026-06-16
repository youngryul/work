import AiTokenBalanceBadge from './AiTokenBalanceBadge.jsx'
import JellyBalanceBadge from './JellyBalanceBadge.jsx'

/**
 * 일기 달력 상단 — 젤리·토큰 배지 한 줄
 * @param {{ refreshDep?: unknown, onDepositClick?: () => void }} props
 */
export default function DiaryCalendarBalanceBar({ refreshDep, onDepositClick }) {
  return (
    <div className="flex items-center gap-2">
      <JellyBalanceBadge inline />
      <AiTokenBalanceBadge
        inline
        compact
        refreshDep={refreshDep}
        onBalanceClick={onDepositClick}
      />
    </div>
  )
}
