import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CONTENT_MAX_LENGTH,
  FEEDBACK_TITLE_MAX_LENGTH,
  getFeedbackCategory,
  getFeedbackStatus,
} from '../../constants/feedback.js'
import { getMyFeedbacks, submitFeedback } from '../../services/feedbackService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

const createEmptyForm = () => ({ category: 'feature', title: '', content: '' })

/**
 * 포실이 피드백 보내기 (사용자용)
 * 작성한 피드백은 본인과 관리자에게만 보임
 */
export default function FeedbackView() {
  const [form, setForm] = useState(createEmptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [myFeedbacks, setMyFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)

  const loadMyFeedbacks = async () => {
    try {
      setMyFeedbacks(await getMyFeedbacks())
    } catch (error) {
      console.error('내 피드백 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMyFeedbacks()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) {
      showToast('제목을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (!form.content.trim()) {
      showToast('내용을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    setIsSubmitting(true)
    try {
      const created = await submitFeedback(form)
      setMyFeedbacks((prev) => [created, ...prev])
      setForm(createEmptyForm())
      showToast('소중한 의견 고마워요! 포실이가 꼭 확인할게요 🥔', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('피드백 제출 실패:', error)
      showToast('피드백 전송에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSubmitting(false)
    }
  }

  const contentPlaceholder =
    form.category === 'bug'
      ? '어떤 화면에서, 무엇을 했을 때, 어떤 문제가 생겼는지 알려주세요.\n예) 일기 달력에서 저장 버튼을 누르면 화면이 멈춰요.'
      : '자유롭게 적어주세요.'

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-4xl font-handwriting text-gray-800 mb-2">포실이 피드백</h1>
        <p className="text-lg text-gray-600 font-sans">
          기능 제안, 버그 제보, 불편한 점 무엇이든 들려주세요. 보낸 의견은 관리자만 볼 수 있어요.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-8 pb-6 font-sans">
        {/* 작성 폼 */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/80 backdrop-blur-sm rounded-xl border-2 border-green-200 p-5 space-y-4"
        >
          <div>
            <p className="block text-base font-medium text-gray-700 mb-2">어떤 의견인가요?</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FEEDBACK_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setForm({ ...form, category: category.id })}
                  className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    form.category === category.id
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-green-200'
                  }`}
                >
                  {category.icon} {category.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="feedback-title" className="block text-base font-medium text-gray-700 mb-2">
              제목
            </label>
            <input
              id="feedback-title"
              type="text"
              value={form.title}
              maxLength={FEEDBACK_TITLE_MAX_LENGTH}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white"
              placeholder="한 줄로 요약해주세요"
            />
          </div>

          <div>
            <label htmlFor="feedback-content" className="block text-base font-medium text-gray-700 mb-2">
              내용
            </label>
            <textarea
              id="feedback-content"
              value={form.content}
              maxLength={FEEDBACK_CONTENT_MAX_LENGTH}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={6}
              className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white resize-y"
              placeholder={contentPlaceholder}
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {form.content.length}/{FEEDBACK_CONTENT_MAX_LENGTH}
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors font-medium shadow-md disabled:opacity-50"
            >
              {isSubmitting ? '보내는 중...' : '의견 보내기'}
            </button>
          </div>
        </form>

        {/* 내가 보낸 피드백 */}
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-3">내가 보낸 의견</h2>
          {loading ? (
            <p className="text-center py-8 text-gray-500">불러오는 중...</p>
          ) : myFeedbacks.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 text-gray-500">
              아직 보낸 의견이 없어요.
            </div>
          ) : (
            <ul className="space-y-3">
              {myFeedbacks.map((feedback) => {
                const category = getFeedbackCategory(feedback.category)
                const status = getFeedbackStatus(feedback.status)
                return (
                  <li key={feedback.id} className="p-4 bg-white/80 rounded-lg border-2 border-gray-200">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${category.className}`}>
                        {category.icon} {category.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                      <span className="ml-auto text-xs text-gray-400">
                        {format(new Date(feedback.createdAt), 'yyyy.MM.dd HH:mm')}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-800">{feedback.title}</p>
                    <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{feedback.content}</p>
                    {feedback.adminReply && (
                      <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                        <p className="text-xs font-semibold text-green-700 mb-0.5">🥔 포실이 답변</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{feedback.adminReply}</p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
