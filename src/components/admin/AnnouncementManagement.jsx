import { useState, useEffect } from 'react'
import {
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../../services/announcementService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 공지사항 관리 컴포넌트
 */
export default function AnnouncementManagement() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    version: '',
    is_active: true,
    priority: 0,
    expires_at: '',
  })

  useEffect(() => {
    loadAnnouncements()
  }, [])

  const loadAnnouncements = async () => {
    setLoading(true)
    try {
      const data = await getAllAnnouncements()
      setAnnouncements(data)
    } catch (error) {
      console.error('공지사항 로드 실패:', error)
      showToast('공지사항을 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingId(null)
    setFormData({
      title: '',
      content: '',
      version: '',
      is_active: true,
      priority: 0,
      expires_at: '',
    })
    setShowForm(true)
  }

  const handleEdit = (announcement) => {
    setEditingId(announcement.id)
    setFormData({
      title: announcement.title,
      content: announcement.content,
      version: announcement.version || '',
      is_active: announcement.is_active,
      priority: announcement.priority || 0,
      expires_at: announcement.expires_at
        ? new Date(announcement.expires_at).toISOString().slice(0, 16)
        : '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('정말 삭제하시겠습니까?')) {
      return
    }

    try {
      await deleteAnnouncement(id)
      showToast('공지사항이 삭제되었습니다.', TOAST_TYPES.SUCCESS)
      loadAnnouncements()
    } catch (error) {
      console.error('공지사항 삭제 실패:', error)
      showToast('공지사항 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const data = {
        ...formData,
        expires_at: formData.expires_at || null,
      }

      if (editingId) {
        await updateAnnouncement(editingId, data)
        showToast('공지사항이 수정되었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await createAnnouncement(data)
        showToast('공지사항이 생성되었습니다.', TOAST_TYPES.SUCCESS)
      }

      setShowForm(false)
      loadAnnouncements()
    } catch (error) {
      console.error('공지사항 저장 실패:', error)
      showToast('공지사항 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleToggleActive = async (announcement) => {
    try {
      await updateAnnouncement(announcement.id, {
        is_active: !announcement.is_active,
      })
      showToast(
        announcement.is_active ? '공지사항이 비활성화되었습니다.' : '공지사항이 활성화되었습니다.',
        TOAST_TYPES.SUCCESS
      )
      loadAnnouncements()
    } catch (error) {
      console.error('공지사항 상태 변경 실패:', error)
      showToast('공지사항 상태 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-2xl text-gray-500 font-sans">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 생성 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={handleCreate}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-sans font-semibold"
        >
          + 공지사항 생성
        </button>
      </div>

      {/* 공지사항 목록 */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 font-sans">공지사항 목록</h2>
          {announcements.length === 0 ? (
            <p className="text-gray-500 text-center py-8 font-sans">공지사항이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className={`p-4 rounded-lg border-2 ${
                    announcement.is_active
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-gray-800 font-sans">
                          {announcement.title}
                        </h3>
                        {announcement.is_active && (
                          <span className="px-2 py-1 bg-green-200 text-green-700 rounded text-xs font-semibold">
                            활성
                          </span>
                        )}
                        <span className="px-2 py-1 bg-blue-200 text-blue-700 rounded text-xs font-semibold">
                          우선순위: {announcement.priority}
                        </span>
                        {announcement.version && (
                          <span className="px-2 py-1 bg-purple-200 text-purple-700 rounded text-xs font-semibold">
                            v{announcement.version}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 mb-2 font-sans whitespace-pre-wrap">
                        {announcement.content}
                      </p>
                      <div className="text-sm text-gray-500 font-sans">
                        생성: {new Date(announcement.created_at).toLocaleString('ko-KR')}
                        {announcement.expires_at &&
                          ` | 만료: ${new Date(announcement.expires_at).toLocaleString('ko-KR')}`}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleToggleActive(announcement)}
                        className={`px-3 py-1.5 rounded text-sm font-sans ${
                          announcement.is_active
                            ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                            : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                      >
                        {announcement.is_active ? '비활성화' : '활성화'}
                      </button>
                      <button
                        onClick={() => handleEdit(announcement)}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 font-sans"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(announcement.id)}
                        className="px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 font-sans"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 생성/수정 폼 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 font-sans">
              {editingId ? '공지사항 수정' : '공지사항 생성'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1 font-sans">
                  제목 *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-400 focus:outline-none font-sans"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1 font-sans">
                  내용 *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-400 focus:outline-none font-sans resize-none"
                  rows="6"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 font-sans">
                    버전
                  </label>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-400 focus:outline-none font-sans"
                    placeholder="예: 1.2.3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 font-sans">
                    우선순위
                  </label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-400 focus:outline-none font-sans"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1 font-sans">
                  만료일
                </label>
                <input
                  type="datetime-local"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-400 focus:outline-none font-sans"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="text-sm font-semibold text-gray-700 font-sans">
                  활성화
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-sans"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-sans"
                >
                  {editingId ? '수정' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
