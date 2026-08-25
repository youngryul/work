import { PROJECT_ARCHIVE_LABELS } from '../constants/projectArchive.js'

/**
 * 프로젝트 목록 컴포넌트
 * @param {Array} projects - 프로젝트 목록 [{ projectName, count }]
 * @param {string|null} selectedProject - 선택된 프로젝트명
 * @param {Function} onSelect - 프로젝트 선택 핸들러
 * @param {Function} onArchive - 프로젝트 보관 핸들러
 * @param {Function} onUnarchive - 프로젝트 보관 해제 핸들러
 * @param {boolean} isArchiveView - 보관함 목록 여부
 */
export default function ProjectList({
  projects = [],
  selectedProject,
  onSelect,
  onArchive,
  onUnarchive,
  isArchiveView = false,
}) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-base font-sans">
        {isArchiveView ? (
          <>
            <p>보관한 프로젝트가 없습니다.</p>
            <p className="text-sm mt-2">
              프로젝트 목록에서 {PROJECT_ARCHIVE_LABELS.archive} 버튼을 눌러 보관할 수 있습니다.
            </p>
          </>
        ) : (
          <>
            <p>프로젝트가 없습니다.</p>
            <p className="text-sm mt-2">새로운 기록을 작성하여 프로젝트를 생성하세요.</p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {projects.map((project) => {
        const isSelected = selectedProject === project.projectName
        return (
          <div
            key={project.projectName}
            className={`rounded-lg border-2 transition-all ${
              isSelected
                ? 'bg-green-100 border-green-400 shadow-md'
                : 'bg-white/60 border-green-200 hover:border-green-300 hover:shadow-sm hover:bg-white/80'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect?.(project.projectName)}
              className="w-full px-4 pt-4 pb-2 text-left font-sans"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold text-gray-800 font-sans break-all">
                  {project.projectName}
                </span>
                <span className="shrink-0 text-sm text-gray-600 bg-green-50 px-2 py-1 rounded-full font-sans">
                  {project.count}개
                </span>
              </div>
            </button>
            <div className="px-4 pb-3 flex justify-end">
              {isArchiveView ? (
                <button
                  type="button"
                  onClick={() => onUnarchive?.(project.projectName)}
                  className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-sans"
                >
                  {PROJECT_ARCHIVE_LABELS.unarchive}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onArchive?.(project.projectName)}
                  className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors font-sans"
                >
                  {PROJECT_ARCHIVE_LABELS.archive}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
