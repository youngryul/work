/**
 * 사이드바 메뉴 아이콘 (이미지 또는 이모지)
 * @param {{ iconSrc?: string, icon?: string, label: string, size?: 'md' | 'sm' | 'lg', compact?: boolean }} props
 */
export default function MenuIcon({ iconSrc, icon, label, size = 'md', compact = false }) {
  const imageClass = compact
    ? 'w-11 h-11 object-contain flex-shrink-0'
    : size === 'lg'
      ? 'w-14 h-14 object-contain flex-shrink-0'
      : size === 'sm'
        ? 'w-10 h-10 object-contain flex-shrink-0'
        : 'w-12 h-12 object-contain flex-shrink-0'

  if (iconSrc) {
    return (
      <span className="inline-flex flex-shrink-0 items-center justify-center">
        <img src={iconSrc} alt="" className={imageClass} aria-hidden="true" />
      </span>
    )
  }

  const emojiClass = compact
    ? 'text-2xl flex-shrink-0 leading-none'
    : size === 'lg'
      ? 'text-4xl flex-shrink-0 leading-none'
      : size === 'sm'
        ? 'text-2xl flex-shrink-0'
        : 'text-3xl flex-shrink-0'
  return <span className={emojiClass}>{icon || '📌'}</span>
}
