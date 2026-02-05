import { useState, useEffect } from 'react'
import { getAllTravels, deleteTravel } from '../../services/travelService.js'
import { COMPANION_TYPE, COMPANION_TYPE_LABEL } from '../../constants/travelConstants.js'
import TravelForm from './TravelForm.jsx'
import TravelCard from './TravelCard.jsx'
import TravelDetail from './TravelDetail.jsx'
import TravelStatistics from './TravelStatistics.jsx'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 국내 여행 기록 메인 화면 컴포넌트
 */
export default function DomesticTravelView() {
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'statistics'
  const [travels, setTravels] = useState([])
  const [filteredTravels, setFilteredTravels] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTravel, setEditingTravel] = useState(null)
  const [selectedTravel, setSelectedTravel] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  
  // 필터 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [filterProvince, setFilterProvince] = useState('')
  const [filterCompanionType, setFilterCompanionType] = useState('')
  const [filterIsFavorite, setFilterIsFavorite] = useState(null)

  /**
   * 여행 목록 로드
   */
  const loadTravels = async () => {
    setIsLoading(true)
    try {
      const filters = {}
      if (searchQuery) filters.search = searchQuery
      if (filterProvince) filters.province = filterProvince
      if (filterCompanionType) filters.companionType = filterCompanionType
      if (filterIsFavorite !== null) filters.isFavorite = filterIsFavorite

      const data = await getAllTravels(filters)
      setTravels(data)
      setFilteredTravels(data)
    } catch (error) {
      console.error('여행 목록 로드 오류:', error)
      showToast(`여행 목록을 불러오는데 실패했습니다: ${error.message || '알 수 없는 오류'}`, TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadTravels()
  }, [searchQuery, filterProvince, filterCompanionType, filterIsFavorite])

  /**
   * 여행 추가
   */
  const handleAdd = () => {
    setEditingTravel(null)
    setShowForm(true)
  }

  /**
   * 여행 수정
   */
  const handleEdit = (travel) => {
    setEditingTravel(travel)
    setShowForm(true)
  }

  /**
   * 여행 상세 보기
   */
  const handleViewDetail = async (travel) => {
    setSelectedTravel(travel)
    setShowDetail(true)
  }

  /**
   * 여행 저장
   */
  const handleSave = async () => {
    setShowForm(false)
    setEditingTravel(null)
    await loadTravels()
  }

  /**
   * 여행 삭제
   */
  const handleDelete = async (id) => {
    if (!confirm('정말 이 여행 기록을 삭제하시겠습니까?')) {
      return
    }

    try {
      await deleteTravel(id)
      await loadTravels()
      showToast('여행 기록이 삭제되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('여행 삭제 오류:', error)
      showToast('삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 필터 초기화
   */
  const handleResetFilters = () => {
    setSearchQuery('')
    setFilterProvince('')
    setFilterCompanionType('')
    setFilterIsFavorite(null)
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-handwriting text-gray-800 mb-2">
              국내 여행 기록
            </h1>
            <p className="text-gray-600">여행을 기록하고 추억을 남겨보세요 ✈️</p>
          </div>
          {activeTab === 'list' && (
            <button
              onClick={handleAdd}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-xl font-medium shadow-md"
            >
              + 새 여행 추가
            </button>
          )}
        </div>

        {/* 탭 메뉴 */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-6 py-3 transition-colors duration-200 text-lg font-medium border-b-2 ${
              activeTab === 'list'
                ? 'border-blue-500 text-blue-600 font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            여행 목록
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`px-6 py-3 transition-colors duration-200 text-lg font-medium border-b-2 ${
              activeTab === 'statistics'
                ? 'border-purple-500 text-purple-600 font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            📊 통계
          </button>
        </div>

        {/* 필터 (리스트 탭에서만 표시) */}
        {activeTab === 'list' && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 검색 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  검색
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제목으로 검색..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 지역 필터 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  지역
                </label>
                <select
                  value={filterProvince}
                  onChange={(e) => setFilterProvince(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">전체</option>
                  {['서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원도', '충청북도', '충청남도', '전라북도', '전라남도', '경상북도', '경상남도', '제주특별자치도'].map(province => (
                    <option key={province} value={province}>{province}</option>
                  ))}
                </select>
              </div>

              {/* 동행 유형 필터 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  동행 유형
                </label>
                <select
                  value={filterCompanionType}
                  onChange={(e) => setFilterCompanionType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">전체</option>
                  {Object.entries(COMPANION_TYPE_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* 즐겨찾기 필터 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  즐겨찾기
                </label>
                <select
                  value={filterIsFavorite === null ? '' : filterIsFavorite ? 'true' : 'false'}
                  onChange={(e) => setFilterIsFavorite(e.target.value === '' ? null : e.target.value === 'true')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">전체</option>
                  <option value="true">즐겨찾기만</option>
                  <option value="false">일반만</option>
                </select>
              </div>
            </div>

            {/* 필터 초기화 버튼 */}
            {(searchQuery || filterProvince || filterCompanionType || filterIsFavorite !== null) && (
              <div className="mt-4">
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  필터 초기화
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <TravelForm
              initialData={editingTravel}
              onSave={handleSave}
              onCancel={() => {
                setShowForm(false)
                setEditingTravel(null)
              }}
            />
          </div>
        </div>
      )}

      {/* 상세 보기 모달 */}
      {showDetail && selectedTravel && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <TravelDetail
              travelId={selectedTravel.id}
              onClose={() => {
                setShowDetail(false)
                setSelectedTravel(null)
              }}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onUpdate={loadTravels}
            />
          </div>
        </div>
      )}

      {/* 컨텐츠 영역 */}
      {activeTab === 'list' ? (
        <>
          {isLoading ? (
            <div className="text-center py-12 text-gray-500 text-2xl">로딩 중...</div>
          ) : filteredTravels.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-2xl">
              {searchQuery || filterProvince || filterCompanionType || filterIsFavorite !== null
                ? '검색 결과가 없습니다.'
                : '여행 기록이 없습니다. 새 여행을 추가해보세요! ✨'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTravels.map((travel) => (
                <TravelCard
                  key={travel.id}
                  travel={travel}
                  onView={handleViewDetail}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <TravelStatistics />
      )}
    </div>
  )
}
