/**
 * 사이드바 메뉴 아이콘 (이모지 우선, 이미지 호환)
 * @param {{ iconSrc?: string, icon?: string, label: string, size?: 'md' | 'sm' | 'lg', compact?: boolean }} props
 */
export default function MenuIcon({ iconSrc, icon, label, size = 'md', compact = false }) {
  const isEmojiPath = typeof iconSrc === 'string' && !iconSrc.includes('/')
  const emoji = icon || (isEmojiPath ? iconSrc : null)

  if (iconSrc && !isEmojiPath) {
    const imageClass = compact
      ? 'w-6 h-6 object-contain flex-shrink-0'
      : size === 'lg'
        ? 'w-8 h-8 object-contain flex-shrink-0'
        : size === 'sm'
          ? 'w-5 h-5 object-contain flex-shrink-0'
          : 'w-6 h-6 object-contain flex-shrink-0'
    return (
      <span className="inline-flex flex-shrink-0 items-center justify-center">
        <img src={iconSrc} alt="" className={imageClass} aria-hidden="true" />
      </span>
    )
  }

  const emojiClass = compact
    ? 'text-base flex-shrink-0 leading-none'
    : size === 'lg'
      ? 'text-2xl flex-shrink-0 leading-none'
      : size === 'sm'
        ? 'text-sm flex-shrink-0 leading-none'
        : 'text-base flex-shrink-0 leading-none'

  return (
    <span className={emojiClass} aria-hidden="true" title={label}>
      {emoji || '📌'}
    </span>
  )
}
