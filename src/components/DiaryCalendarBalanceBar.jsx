import AiTokenBalanceBadge from './AiTokenBalanceBadge.jsx'
import JellyBalanceBadge from './JellyBalanceBadge.jsx'

/**
 * 상단 — 젤리·토큰 배지 한 줄
 * @param {{ refreshDep?: unknown, onDepositClick?: () => void, tokenMinRequired?: number }} props
 */
export default function DiaryCalendarBalanceBar({
  refreshDep,
  onDepositClick,
  tokenMinRequired,
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <JellyBalanceBadge inline />
      <AiTokenBalanceBadge
        inline
        compact
        refreshDep={refreshDep}
        onBalanceClick={onDepositClick}
        minRequired={tokenMinRequired}
      />
    </div>
  )
}
