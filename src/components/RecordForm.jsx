import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { createRecord, updateRecord } from '../services/recordService.js'
import { getAllProjectNames } from '../services/recordService.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/** 입력이 멈춘 뒤 자동 저장까지 대기 시간 (대학원 기록과 동일) */
const AUTO_SAVE_DELAY_MS = 2000

/**
 * 기록 작성/수정 폼 컴포넌트 (입력 후 자동 저장)
 * - 새 기록은 프로젝트명과 제목이 채워지면 처음 저장 시 생성하고, 이후에는 수정으로 저장한다.
 * @param {Object|null} initialRecord - 초기 기록 데이터 (수정 모드)
 * @param {Function} onSave - 닫기 핸들러 (대기 중인 변경을 저장한 뒤 호출)
 * @param {Function} onCancel - 사용하지 않음 (호환용)
 */
export default function RecordForm({ initialRecord = null, onSave, onCancel }) {
  const isEditMode = !!initialRecord

  // 폼 상태
  const [formData, setFormData] = useState({
    projectName: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    content: '',
  })

  // 프로젝트 자동완성 상태
  const [projectNames, setProjectNames] = useState([])
  const [filteredProjects, setFilteredProjects] = useState([])
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(-1)
  const projectInputRef = useRef(null)
  const projectDropdownRef = useRef(null)

  // 자동 저장 상태
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const recordIdRef = useRef(initialRecord?.id ?? null)
  const latestFormRef = useRef(formData)
  const lastSavedRef = useRef(null) // 마지막으로 저장한 폼 스냅샷(JSON)
  const savingPromiseRef = useRef(null)

  // 프로젝트명 목록 로드
  useEffect(() => {
    const loadProjectNames = async () => {
      try {
        const names = await getAllProjectNames()
        setProjectNames(names)
      } catch (error) {
        console.error('프로젝트명 로드 실패:', error)
      }
    }
    loadProjectNames()
  }, [])

  // 초기 데이터 로드
  useEffect(() => {
    if (initialRecord) {
      // 기존 데이터에서 content 생성 (background를 우선 사용, 없으면 content 사용)
      const existingContent = initialRecord.content || initialRecord.background || ''

      const loaded = {
        projectName: initialRecord.projectName || initialRecord.projectname || '',
        date: initialRecord.date || format(new Date(), 'yyyy-MM-dd'),
        title: initialRecord.title || '',
        content: existingContent,
      }
      // 불러온 내용 그대로는 다시 저장하지 않는다
      lastSavedRef.current = JSON.stringify(loaded)
      recordIdRef.current = initialRecord.id
      setFormData(loaded)
    }
  }, [initialRecord])

  // 프로젝트명 입력 시 필터링
  useEffect(() => {
    if (formData.projectName.trim() === '') {
      setFilteredProjects([])
      setShowProjectDropdown(false)
      return
    }

    const filtered = projectNames.filter((name) =>
      name.toLowerCase().includes(formData.projectName.toLowerCase())
    )
    setFilteredProjects(filtered)
    setShowProjectDropdown(filtered.length > 0)
    setSelectedProjectIndex(-1)
  }, [formData.projectName, projectNames])

  // 폼 필드 업데이트
  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // 프로젝트명 선택
  const handleProjectSelect = (projectName) => {
    updateField('projectName', projectName)
    setShowProjectDropdown(false)
    setSelectedProjectIndex(-1)
    projectInputRef.current?.blur()
  }

  // 프로젝트명 입력 필드 키보드 이벤트
  const handleProjectKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedProjectIndex((prev) =>
        prev < filteredProjects.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedProjectIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter' && selectedProjectIndex >= 0) {
      e.preventDefault()
      handleProjectSelect(filteredProjects[selectedProjectIndex])
    } else if (e.key === 'Escape') {
      setShowProjectDropdown(false)
      setSelectedProjectIndex(-1)
    }
  }

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        projectInputRef.current &&
        !projectInputRef.current.contains(event.target) &&
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(event.target)
      ) {
        setShowProjectDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  /**
   * 현재 입력을 저장
   * @returns {Promise<boolean|null>} 저장 성공 true, 실패 false, 저장할 변경 없음 null
   */
  const saveNow = useCallback(async () => {
    // 앞선 저장이 끝난 뒤 진행해 새 기록이 중복 생성되지 않게 한다
    if (savingPromiseRef.current) await savingPromiseRef.current

    const data = latestFormRef.current
    if (!data.projectName.trim() || !data.title.trim()) return null
    const snapshot = JSON.stringify(data)
    if (snapshot === lastSavedRef.current) return null

    const run = (async () => {
      setSaving(true)
      try {
        const dataToSave = {
          projectName: data.projectName,
          date: data.date,
          title: data.title,
          content: data.content,
          background: null,
          discussion: null,
          problem: null,
          decision: null,
          actionItems: [],
        }
        if (recordIdRef.current) {
          await updateRecord(recordIdRef.current, dataToSave)
        } else {
          const created = await createRecord(dataToSave)
          recordIdRef.current = created.id
        }
        lastSavedRef.current = snapshot
        setSavedAt(new Date())
        return true
      } catch (error) {
        console.error('자동 저장 실패:', error)
        showToast('기록 저장에 실패했습니다.', TOAST_TYPES.ERROR)
        return false
      } finally {
        setSaving(false)
      }
    })()

    savingPromiseRef.current = run
    try {
      return await run
    } finally {
      if (savingPromiseRef.current === run) savingPromiseRef.current = null
    }
  }, [])

  // 입력이 멈추면 자동 저장
  useEffect(() => {
    latestFormRef.current = formData
    const timer = setTimeout(() => {
      saveNow()
    }, AUTO_SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [formData, saveNow])

  // 화면을 벗어날 때 대기 중인 변경 저장
  useEffect(() => () => { saveNow() }, [saveNow])

  // 닫기: 대기 중인 변경을 바로 저장한 뒤 목록으로
  const handleClose = async () => {
    const result = await saveNow()
    if (result === false) return // 저장 실패 시 작성 내용을 잃지 않도록 머문다
    window.dispatchEvent(new CustomEvent('recordSaved'))
    onSave?.()
  }

  const canSave = formData.projectName.trim() !== '' && formData.title.trim() !== ''
  const saveStatus = saving
    ? '저장 중...'
    : savedAt
      ? `저장됨 ${savedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
      : canSave
        ? '입력하면 자동으로 저장돼요'
        : '프로젝트명과 제목을 입력하면 자동으로 저장돼요'

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border-2 border-green-200 p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 font-sans">
            {isEditMode ? '기록 수정' : '새 기록 작성'}
          </h1>
          <p className="text-base text-gray-600 font-sans">
            {isEditMode ? '수정한 내용은 자동으로 저장돼요' : '작성한 내용은 자동으로 저장돼요'}
          </p>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 border-b-2 border-green-200 pb-2 font-sans">
              기본 정보
            </h2>

            {/* 프로젝트명 */}
            <div className="relative">
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                프로젝트명 *
              </label>
              <input
                ref={projectInputRef}
                type="text"
                value={formData.projectName}
                onChange={(e) => updateField('projectName', e.target.value)}
                onFocus={() => {
                  if (filteredProjects.length > 0) {
                    setShowProjectDropdown(true)
                  }
                }}
                onKeyDown={handleProjectKeyDown}
                required
                placeholder="프로젝트명을 입력하거나 선택하세요"
                className="w-full px-3 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans"
              />
              
              {/* 프로젝트 자동완성 드롭다운 */}
              {showProjectDropdown && filteredProjects.length > 0 && (
                <div
                  ref={projectDropdownRef}
                  className="absolute z-50 w-full mt-1 bg-white border-2 border-green-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                >
                  {filteredProjects.map((projectName, index) => (
                    <button
                      key={projectName}
                      type="button"
                      onClick={() => handleProjectSelect(projectName)}
                      className={`w-full text-left px-4 py-2 hover:bg-green-50 focus:bg-green-50 focus:outline-none transition-colors ${
                        index === selectedProjectIndex ? 'bg-green-100' : ''
                      }`}
                    >
                      <span className="text-gray-900 font-sans">{projectName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 작성일 */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                작성일 *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateField('date', e.target.value)}
                required
                className="w-full px-3 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans"
              />
            </div>

            {/* 제목 */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                제목 *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                required
                className="w-full px-3 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans"
              />
            </div>
          </div>

          {/* 본문 내용 */}
          <div className="space-y-4">
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                내용
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => updateField('content', e.target.value)}
                placeholder="기록 내용을 입력하세요..."
                rows={12}
                className="w-full px-3 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans resize-y"
              />
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-4 items-center justify-end pt-4 border-t-2 border-green-200">
            <span className="text-sm text-gray-500 font-sans mr-auto">{saveStatus}</span>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-base font-medium shadow-md font-sans"
            >
              닫기
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
