import { useAiTokenInfo } from '../hooks/useAiTokenInfo.js'

/**
 * AI 토큰 보유량 (화면 오른쪽 상단, 변동 시 즉시 갱신)
 * @param {{ refreshDep?: unknown, className?: string }} props
 */
export default function AiTokenBalanceBadge({ refreshDep, className = '' }) {
  const { balance, generationCost, isLoading } = useAiTokenInfo(refreshDep)

  if (isLoading || balance === null) return null

  const isLow = balance < generationCost

  return (
    <div
      className={`absolute top-0 right-0 z-10 flex flex-col items-end gap-0.5 ${className}`}
      aria-label={`AI 토큰 보유 ${balance}개`}
    >
      <div
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-sans shadow-sm transition-all ${
          isLow
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <span aria-hidden="true">🪙</span>
        <span className="text-xs text-current/80">보유</span>
        <span className="text-base font-bold tabular-nums">{balance}</span>
      </div>
      {isLow && (
        <span className="text-xs font-medium text-red-600 font-sans">토큰 부족</span>
      )}
    </div>
  )
}
