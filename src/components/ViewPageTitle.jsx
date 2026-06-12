import MenuIcon from './MenuIcon.jsx'

/**
 * 메인 화면 제목 + 포실이 아이콘
 * @param {{ iconSrc?: string, icon?: string, title: string, children?: import('react').ReactNode }} props
 */
export default function ViewPageTitle({ iconSrc, icon, title, children }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        {iconSrc ? (
          <MenuIcon iconSrc={iconSrc} label={title} size="lg" />
        ) : icon ? (
          <span className="text-4xl" aria-hidden="true">{icon}</span>
        ) : null}
        <h1 className="text-4xl font-handwriting text-gray-800">{title}</h1>
      </div>
      {children}
    </div>
  )
}
