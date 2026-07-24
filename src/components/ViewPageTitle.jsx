import MenuIcon from './MenuIcon.jsx'

/**
 * 메인 화면 제목 + 포실이 아이콘
 * @param {{ iconSrc?: string, icon?: string, title: string, children?: import('react').ReactNode }} props
 */
export default function ViewPageTitle({ iconSrc, icon, title, children }) {
  const resolvedIcon =
    icon || (typeof iconSrc === 'string' && !iconSrc.includes('/') ? iconSrc : null)
  const imageSrc =
    typeof iconSrc === 'string' && iconSrc.includes('/') ? iconSrc : null

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        {imageSrc ? (
          <MenuIcon iconSrc={imageSrc} label={title} size="lg" />
        ) : resolvedIcon ? (
          <span className="text-3xl leading-none" aria-hidden="true">
            {resolvedIcon}
          </span>
        ) : null}
        <h1 className="text-4xl font-handwriting text-gray-800">{title}</h1>
      </div>
      {children}
    </div>
  )
}
