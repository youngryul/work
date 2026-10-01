import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  getFeedbackCategory,
  getFeedbackStatus,
} from '../../constants/feedback.js'
import {
  deleteFeedbackByAdmin,
  getAllFeedbacks,
  updateFeedbackByAdmin,
} from '../../services/feedbackService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 관리자: 사용자 피드백 목록 · 상태 변경 · 답변
 */
export default function FeedbackManagement() {
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [replyDrafts, setReplyDrafts] = useState({})
  const [updatingId, setUpdatingId] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setFeedbacks(await getAllFeedbacks())
    } catch (error) {
      console.error('피드백 목록 로드 실패:', error)
      showToast('피드백 목록을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const applyUpdate = async (id, updates, successMessage) => {
    setUpdatingId(id)
    try {
      const updated = await updateFeedbackByAdmin(id, updates)
      setFeedbacks((prev) => prev.map((item) => (item.id === id ? updated : item)))
      showToast(successMessage, TOAST_TYPES.SUCCESS)
      return true
    } catch (error) {
      console.error('피드백 수정 실패:', error)
      showToast('변경에 실패했습니다.', TOAST_TYPES.ERROR)
      return false
    } finally {
      setUpdatingId('')
    }
  }

  const handleSaveReply = async (feedback) => {
    const reply = replyDrafts[feedback.id] ?? feedback.adminReply ?? ''
    const ok = await applyUpdate(feedback.id, { adminReply: reply }, '답변을 저장했습니다.')
    if (ok) {
      setReplyDrafts((prev) => {
        const next = { ...prev }
        delete next[feedback.id]
        return next
      })
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 피드백을 삭제할까요?')) return
    try {
      await deleteFeedbackByAdmin(id)
      setFeedbacks((prev) => prev.filter((item) => item.id !== id))
      showToast('삭제했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('피드백 삭제 실패:', error)
      showToast('삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const filtered = feedbacks.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
    return true
  })
  const pendingCount = feedbacks.filter((item) => item.status === 'pending').length

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-2xl text-gray-500 font-sans">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-900">
        사용자가 보낸 피드백입니다. 전체 {feedbacks.length}건 중 <strong>새 접수 {pendingCount}건</strong>.
        답변을 저장하면 작성자의 피드백 화면에 표시됩니다.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[{ id: 'all', label: '전체 상태' }, ...FEEDBACK_STATUSES].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              statusFilter === tab.id ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <span className="text-gray-300 hidden sm:inline">|</span>
        {[{ id: 'all', label: '전체 유형' }, ...FEEDBACK_CATEGORIES].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCategoryFilter(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              categoryFilter === tab.id ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tab.icon ? `${tab.icon} ` : ''}
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 text-gray-500">
          해당하는 피드백이 없습니다.
        </div>
      ) : (
        <ul className="space-y-4">
          {filtered.map((feedback) => {
            const category = getFeedbackCategory(feedback.category)
            const status = getFeedbackStatus(feedback.status)
            const replyValue = replyDrafts[feedback.id] ?? feedback.adminReply ?? ''
            const isReplyChanged = replyValue !== (feedback.adminReply ?? '')
            const isUpdating = updatingId === feedback.id
            return (
              <li key={feedback.id} className="p-5 bg-white rounded-lg border-2 border-gray-200 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${category.className}`}>
                    {category.icon} {category.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                  <span className="text-xs text-gray-500">{feedback.userEmail || '이메일 없음'}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {format(new Date(feedback.createdAt), 'yyyy.MM.dd HH:mm')}
                  </span>
                </div>
                <p className="text-lg font-semibold text-gray-800">{feedback.title}</p>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{feedback.content}</p>

                <div className="mt-4 space-y-2">
                  <textarea
                    value={replyValue}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [feedback.id]: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-y"
                    placeholder="작성자에게 보여줄 답변 (선택)"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={feedback.status}
                      disabled={isUpdating}
                      onChange={(e) =>
                        applyUpdate(feedback.id, { status: e.target.value }, '상태를 변경했습니다.')
                      }
                      className="px-3 py-1.5 border-2 border-gray-200 rounded-lg text-sm bg-white"
                    >
                      {FEEDBACK_STATUSES.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleSaveReply(feedback)}
                      disabled={isUpdating || !isReplyChanged}
                      className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50"
                    >
                      답변 저장
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(feedback.id)}
                      className="ml-auto px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm hover:bg-red-200"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
