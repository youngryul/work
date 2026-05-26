import MenuIcon from './MenuIcon.jsx'

/**
 * 메인 화면 제목 + 포실이 아이콘
 * @param {{ iconSrc: string, title: string, children?: import('react').ReactNode }} props
 */
export default function ViewPageTitle({ iconSrc, title, children }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <MenuIcon iconSrc={iconSrc} label={title} size="lg" />
        <h1 className="text-4xl font-handwriting text-gray-800">{title}</h1>
      </div>
      {children}
    </div>
  )
}
