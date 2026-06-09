import { useAiTokenInfo } from '../hooks/useAiTokenInfo.js'

/**
 * AI 토큰 보유량 (화면 오른쪽 상단, 변동 시 즉시 갱신)
 * @param {{ refreshDep?: unknown, className?: string, onBalanceClick?: () => void, onLowBalanceClick?: () => void }} props
 */
export default function AiTokenBalanceBadge({
  refreshDep,
  className = '',
  onBalanceClick,
  onLowBalanceClick,
}) {
  const { balance, generationCost, isLoading } = useAiTokenInfo(refreshDep)

  if (isLoading || balance === null) return null

  const isLow = balance < generationCost
  const handleBalanceClick = onBalanceClick ?? onLowBalanceClick

  const badgeClass = `inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-sans shadow-sm transition-all ${
    isLow
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-amber-50 border-amber-200 text-amber-900'
  } ${handleBalanceClick ? (isLow ? 'hover:bg-red-100 cursor-pointer' : 'hover:bg-amber-100 cursor-pointer') : ''}`

  const badgeContent = (
    <>
      <span aria-hidden="true">🪙</span>
      <span className="text-xs text-current/80">보유</span>
      <span className="text-base font-bold tabular-nums">{balance}</span>
    </>
  )

  return (
    <div
      className={`absolute top-0 right-0 z-10 flex flex-col items-end gap-0.5 ${className}`}
      aria-label={`AI 토큰 보유 ${balance}개`}
    >
      {handleBalanceClick ? (
        <button
          type="button"
          onClick={handleBalanceClick}
          className={badgeClass}
          title="토큰 충전 신청"
        >
          {badgeContent}
        </button>
      ) : (
        <div className={badgeClass}>{badgeContent}</div>
      )}
      {handleBalanceClick && (
        <button
          type="button"
          onClick={handleBalanceClick}
          className={`text-xs font-medium font-sans underline ${
            isLow ? 'text-red-600 hover:text-red-800' : 'text-amber-700 hover:text-amber-900'
          }`}
        >
          토큰 충전 신청
        </button>
      )}
    </div>
  )
}
