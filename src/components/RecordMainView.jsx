import { useState, useEffect } from 'react'
import RecordFilters from './RecordFilters.jsx'
import RecordList from './RecordList.jsx'
import RecordDetail from './RecordDetail.jsx'
import RecordModal from './RecordModal.jsx'
import ProjectList from './ProjectList.jsx'
import { 
  getAllRecords, 
  deleteRecord, 
  getProjectCountsByArchiveState,
  archiveProject,
  unarchiveProject,
  getMainRecordByProject,
  setMainRecord,
  unsetMainRecord
} from '../services/recordService.js'
import { PROJECT_ARCHIVE_LABELS } from '../constants/projectArchive.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * 기록 메인 화면 컴포넌트
 * @param {Function} onNewRecord - 새 기록 작성 핸들러
 * @param {Function} onEditRecord - 기록 수정 핸들러
 */
export default function RecordMainView({ onNewRecord, onEditRecord }) {
  const [activeProjects, setActiveProjects] = useState([]) // [{ projectName, count }]
  const [archivedProjects, setArchivedProjects] = useState([]) // 보관한 프로젝트
  const [isArchiveView, setIsArchiveView] = useState(false)
  const [isProjectsLoading, setIsProjectsLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState(null)
  const [mainRecord, setMainRecordState] = useState(null)
  const [records, setRecords] = useState([])
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filters, setFilters] = useState({
    projectName: null,
    keyword: null,
    startDate: null,
    endDate: null,
  })
  const [loading, setLoading] = useState(false)

  /**
   * 프로젝트 목록(일반·보관) 및 개수 로드
   * @returns {Promise<{ activeProjects: Array, archivedProjects: Array }>}
   */
  const loadProjects = async () => {
    try {
      const result = await getProjectCountsByArchiveState()
      setActiveProjects(result.activeProjects)
      setArchivedProjects(result.archivedProjects)
      return result
    } catch (error) {
      console.error('프로젝트 목록 로드 실패:', error)
      return { activeProjects: [], archivedProjects: [] }
    } finally {
      setIsProjectsLoading(false)
    }
  }

  // 프로젝트 선택 시 메인 기록 및 기록 목록 로드
  const loadProjectData = async (projectName) => {
    if (!projectName) return

    setLoading(true)
    try {
      // 메인 기록 로드
      const main = await getMainRecordByProject(projectName)
      setMainRecordState(main)

      // 해당 프로젝트의 모든 기록 로드
      const projectFilters = { ...filters, projectName }
      const data = await getAllRecords(projectFilters)
      const parsedRecords = data.map(parseRecordData)
      setRecords(parsedRecords)
    } catch (error) {
      console.error('프로젝트 데이터 로드 실패:', error)
      showToast('데이터를 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  // 프로젝트 목록 초기 로드 (첫 번째 프로젝트를 기본 선택)
  useEffect(() => {
    const init = async () => {
      const { activeProjects: initialProjects } = await loadProjects()
      setSelectedProject((current) => current ?? initialProjects[0]?.projectName ?? null)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 저장 완료 후 프로젝트 목록 다시 로드
  useEffect(() => {
    const handleRecordSaved = () => {
      loadProjects()
      // 선택된 프로젝트가 있으면 데이터도 다시 로드
      if (selectedProject) {
        loadProjectData(selectedProject)
      }
    }

    window.addEventListener('recordSaved', handleRecordSaved)
    return () => window.removeEventListener('recordSaved', handleRecordSaved)
  }, [selectedProject])

  // 프로젝트 선택 또는 필터 변경 시 데이터 로드
  useEffect(() => {
    if (selectedProject) {
      loadProjectData(selectedProject)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, filters.type, filters.keyword, filters.startDate, filters.endDate])

  // 기록 선택 (팝업 열기)
  const handleSelect = (id) => {
    const record = records.find((r) => r.id === id)
    if (record) {
      setSelectedRecord(record)
      setIsModalOpen(true)
    }
  }

  // 기록 수정
  const handleEdit = (record) => {
    onEditRecord?.(record)
  }

  // 기록 삭제
  const handleDelete = async (id) => {
    try {
      await deleteRecord(id)
      // 삭제된 기록이 메인 기록이었으면 메인 기록 초기화
      if (mainRecord && mainRecord.id === id) {
        setMainRecordState(null)
      }
      setSelectedRecord(null)
      setIsModalOpen(false)
      // 프로젝트 데이터 다시 로드
      if (selectedProject) {
        await loadProjectData(selectedProject)
        await loadProjects() // 프로젝트 개수 업데이트
      }
    } catch (error) {
      console.error('기록 삭제 실패:', error)
      showToast('기록 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  // 메인 기록 설정
  const handleSetMainRecord = async (id) => {
    if (!selectedProject) return

    try {
      await setMainRecord(id, selectedProject)
      // 프로젝트 데이터 다시 로드
      await loadProjectData(selectedProject)
      showToast('메인 기록으로 설정되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('메인 기록 설정 실패:', error)
      showToast('메인 기록 설정에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  // 메인 기록 해제
  const handleUnsetMainRecord = async (id) => {
    try {
      await unsetMainRecord(id)
      // 프로젝트 데이터 다시 로드
      if (selectedProject) {
        await loadProjectData(selectedProject)
      }
      showToast('메인 기록이 해제되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('메인 기록 해제 실패:', error)
      showToast('메인 기록 해제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  // 프로젝트 선택
  const handleProjectSelect = (projectName) => {
    setSelectedProject(projectName)
  }

  // 프로젝트 보관 (프로젝트 목록에서 숨기고 보관함으로 이동)
  const handleArchiveProject = async (projectName) => {
    try {
      await archiveProject(projectName)
      const { activeProjects: nextProjects } = await loadProjects()
      if (selectedProject === projectName) {
        setSelectedProject(nextProjects[0]?.projectName ?? null)
      }
      showToast(`「${projectName}」을(를) 보관함으로 옮겼습니다.`, TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('프로젝트 보관 실패:', error)
      showToast(error?.message || '프로젝트 보관에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  // 프로젝트 보관 해제 (보관함에서 프로젝트 목록으로 복원)
  const handleUnarchiveProject = async (projectName) => {
    try {
      await unarchiveProject(projectName)
      const { archivedProjects: nextArchived } = await loadProjects()
      if (selectedProject === projectName) {
        setSelectedProject(nextArchived[0]?.projectName ?? null)
      }
      showToast(`「${projectName}」을(를) 프로젝트 목록으로 복원했습니다.`, TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('프로젝트 보관 해제 실패:', error)
      showToast(error?.message || '프로젝트 복원에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  // 보관함 ↔ 프로젝트 목록 전환 (전환한 목록의 첫 프로젝트를 선택)
  const handleToggleArchiveView = () => {
    const nextIsArchiveView = !isArchiveView
    const nextProjects = nextIsArchiveView ? archivedProjects : activeProjects
    setIsArchiveView(nextIsArchiveView)
    setSelectedProject(nextProjects[0]?.projectName ?? null)
  }

  const visibleProjects = isArchiveView ? archivedProjects : activeProjects

  // Supabase 데이터를 애플리케이션 형식으로 변환
  function parseRecordData(data) {
    return {
      ...data,
      projectName: data.projectname,
      content: data.background || data.content || '',
      isMain: data.is_main || false,
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-800 mb-2 font-sans">
          프로젝트 기록
        </h1>
        <div className="flex gap-4 items-center">
          <button
            onClick={onNewRecord}
            className="px-6 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-base font-medium shadow-md font-sans"
          >
            + 새 기록 작성
          </button>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 좌측: 프로젝트 목록 */}
        <div className="lg:col-span-1">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border border-green-200 p-4 h-[calc(100vh-200px)] overflow-y-auto">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-xl font-semibold text-gray-700 font-sans">
                {isArchiveView
                  ? PROJECT_ARCHIVE_LABELS.archiveView
                  : PROJECT_ARCHIVE_LABELS.activeView}
              </h2>
              <button
                type="button"
                onClick={handleToggleArchiveView}
                className="shrink-0 px-3 py-1 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-sans"
              >
                {isArchiveView
                  ? `← ${PROJECT_ARCHIVE_LABELS.activeView}`
                  : `📦 ${PROJECT_ARCHIVE_LABELS.archiveView} ${archivedProjects.length}`}
              </button>
            </div>
            {isProjectsLoading ? (
              <div className="text-center py-8 text-gray-500 text-base font-sans">로딩 중...</div>
            ) : (
              <ProjectList
                projects={visibleProjects}
                selectedProject={selectedProject}
                onSelect={handleProjectSelect}
                onArchive={handleArchiveProject}
                onUnarchive={handleUnarchiveProject}
                isArchiveView={isArchiveView}
              />
            )}
          </div>
        </div>

        {/* 우측: 메인 기록 및 기록 목록 */}
        <div className="lg:col-span-3">
          {selectedProject ? (
            <div className="space-y-6">
              {/* 상단: 메인 기록 */}
              <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border-2 border-green-300 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-700 font-sans">
                    📌 메인 기록
                  </h2>
                  {mainRecord && (
                    <button
                      onClick={() => handleUnsetMainRecord(mainRecord.id)}
                      className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-sans"
                    >
                      메인 해제
                    </button>
                  )}
                </div>
                {loading ? (
                  <div className="text-center py-8 text-gray-500 text-base font-sans">로딩 중...</div>
                ) : mainRecord ? (
                  <div className="max-h-96 overflow-y-auto">
                    <RecordDetail
                      record={mainRecord}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 text-base font-sans">
                    <p>메인 기록이 설정되지 않았습니다.</p>
                    <p className="text-sm mt-2">기록 목록에서 기록을 클릭하여 메인 기록으로 설정할 수 있습니다.</p>
                  </div>
                )}
              </div>

              {/* 하단: 기록 목록 */}
              <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border border-green-200 p-4 h-[calc(100vh-500px)] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-700 font-sans">기록 목록</h2>
                </div>
                {loading ? (
                  <div className="text-center py-8 text-gray-500 text-base font-sans">로딩 중...</div>
                ) : (
                  <RecordList
                    records={records}
                    selectedId={null}
                    onSelect={handleSelect}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 text-base font-sans">
              <p>프로젝트를 선택해주세요.</p>
              <p className="text-sm mt-2">왼쪽에서 프로젝트를 선택하거나 새 기록을 작성하여 프로젝트를 생성하세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* 기록 상세 모달 */}
      <RecordModal
        record={selectedRecord}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedRecord(null)
        }}
        onEdit={(record) => {
          setIsModalOpen(false)
          handleEdit(record)
        }}
        onDelete={handleDelete}
        onSetMain={(id) => {
          handleSetMainRecord(id)
          setIsModalOpen(false)
          setSelectedRecord(null)
        }}
        onUnsetMain={(id) => {
          handleUnsetMainRecord(id)
          setIsModalOpen(false)
          setSelectedRecord(null)
        }}
      />
    </div>
  )
}
