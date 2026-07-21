/**
 * 타이머 배경음악 on/off 토글
 * @param {{ enabled: boolean, onToggle: () => void, className?: string }} props
 */
export default function TimerBgmToggle({ enabled, onToggle, className = '' }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-md transition ${
        enabled
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-white/70 text-gray-600 hover:bg-white'
      } ${className}`}
      aria-pressed={enabled}
      aria-label={enabled ? '배경음악 끄기' : '배경음악 켜기'}
      title={enabled ? '배경음악 ON' : '배경음악 OFF'}
    >
      <span aria-hidden>{enabled ? '🎵' : '🔇'}</span>
      <span>음악 {enabled ? 'ON' : 'OFF'}</span>
    </button>
  )
}
