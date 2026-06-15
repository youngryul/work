import { useJellyBalance } from '../hooks/useJellyBalance.js'

/**
 * 젤리 보유량 배지
 * @param {{ className?: string, inline?: boolean }} props — inline: 상단 바에 배치 (fixed 미사용)
 */
export default function JellyBalanceBadge({ className = '', inline = false }) {
  const { balance, isLoading } = useJellyBalance()

  if (isLoading || balance === null) return null

  const wrapperClass = inline ? className : `fixed top-16 md:top-4 right-4 z-40 ${className}`

  return (
    <div
      className={wrapperClass}
      aria-label={`젤리 보유 ${balance}개`}
    >
      <div className="inline-flex items-center gap-2 rounded-xl border border-pink-200 bg-pink-50 px-3 py-2 text-sm font-sans shadow-sm text-pink-900">
        <span aria-hidden="true">🍮</span>
        <span className="text-xs text-pink-700/80">젤리</span>
        <span className="text-base font-bold tabular-nums">{balance}</span>
      </div>
    </div>
  )
}
