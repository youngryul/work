/**
 * 프로젝트 목록 컴포넌트
 * @param {Array} projects - 프로젝트 목록 [{ projectName, count }]
 * @param {string|null} selectedProject - 선택된 프로젝트명
 * @param {Function} onSelect - 프로젝트 선택 핸들러
 */
export default function ProjectList({ projects = [], selectedProject, onSelect }) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-base font-sans">
        <p>프로젝트가 없습니다.</p>
        <p className="text-sm mt-2">새로운 기록을 작성하여 프로젝트를 생성하세요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => (
        <button
          key={project.projectName}
          onClick={() => onSelect(project.projectName)}
          className={`w-full p-4 rounded-lg border-2 text-left transition-all font-sans ${
            selectedProject === project.projectName
              ? 'bg-pink-100 border-pink-400 shadow-md'
              : 'bg-white/60 border-pink-200 hover:border-pink-300 hover:shadow-sm hover:bg-white/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-gray-800 font-sans">
              {project.projectName}
            </span>
            <span className="text-sm text-gray-600 bg-pink-50 px-2 py-1 rounded-full font-sans">
              {project.count}개
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
