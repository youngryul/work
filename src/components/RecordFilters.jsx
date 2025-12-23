import { useState, useEffect } from 'react'
import { getAllProjectNames } from '../services/recordService.js'

/**
 * 기록 필터 컴포넌트
 * @param {Object} filters - 현재 필터 값
 * @param {Function} onFilterChange - 필터 변경 핸들러
 */
export default function RecordFilters({ filters, onFilterChange }) {
  const [projectNames, setProjectNames] = useState([])
  const [isOpen, setIsOpen] = useState(false)

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

  const handleKeywordChange = (e) => {
    onFilterChange({ ...filters, keyword: e.target.value || null })
  }

  const handleStartDateChange = (e) => {
    onFilterChange({ ...filters, startDate: e.target.value || null })
  }

  const handleEndDateChange = (e) => {
    onFilterChange({ ...filters, endDate: e.target.value || null })
  }

  const handleProjectChange = (e) => {
    onFilterChange({ ...filters, projectName: e.target.value || null })
  }

  const handleReset = () => {
    onFilterChange({
      projectName: null,
      keyword: null,
      startDate: null,
      endDate: null,
    })
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border-2 border-pink-200">
      {/* 아코디언 헤더 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-pink-50 transition-colors"
      >
        <h3 className="text-xl font-semibold text-gray-800 font-sans">필터</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              handleReset()
            }}
            className="text-sm text-gray-600 hover:text-gray-900 font-sans"
          >
            초기화
          </button>
          <svg
            className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* 아코디언 컨텐츠 */}
      {isOpen && (
        <div className="p-4 pt-0 space-y-4 border-t-2 border-pink-200">

          {/* 프로젝트명 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              프로젝트
            </label>
            <select
              value={filters.projectName || ''}
              onChange={handleProjectChange}
              className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
            >
              <option value="">전체 프로젝트</option>
              {projectNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* 키워드 검색 */}
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
              키워드 검색
            </label>
            <input
              type="text"
              value={filters.keyword || ''}
              onChange={handleKeywordChange}
              placeholder="제목, 프로젝트명, 내용 검색..."
              className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
            />
          </div>

          {/* 기간 필터 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                시작일
              </label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={handleStartDateChange}
                className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
              />
            </div>
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                종료일
              </label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={handleEndDateChange}
                className="w-full px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
