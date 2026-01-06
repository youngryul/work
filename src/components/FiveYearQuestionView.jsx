import { useState, useEffect } from 'react'
import { getQuestionAndAnswersByDate, saveAnswer, deleteAnswer } from '../services/fiveYearQuestionService.js'
import FiveYearQuestionDashboard from './FiveYearQuestionDashboard.jsx'

/**
 * 5년 질문 일기 뷰 컴포넌트
 */
export default function FiveYearQuestionView() {
  const [activeTab, setActiveTab] = useState('dashboard') // 'question' | 'dashboard'
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [question, setQuestion] = useState(null)
  const [answers, setAnswers] = useState([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingAnswerId, setEditingAnswerId] = useState(null)

  const currentYear = selectedDate.getFullYear()

  /**
   * 날짜 포맷팅
   */
  const formatDate = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const weekday = weekdays[date.getDay()]
    return `${year}년 ${month}월 ${day}일 (${weekday})`
  }

  /**
   * 질문과 답변 로드
   */
  const loadQuestionAndAnswers = async () => {
    setIsLoading(true)
    try {
      const { question: q, answers: a } = await getQuestionAndAnswersByDate(selectedDate)
      setQuestion(q)
      setAnswers(a || [])
      
      // 올해 답변 찾기
      const currentYearAnswer = a?.find(ans => ans.year === currentYear)
      if (currentYearAnswer) {
        setCurrentAnswer(currentYearAnswer.content || '')
        setEditingAnswerId(currentYearAnswer.id)
      } else {
        setCurrentAnswer('')
        setEditingAnswerId(null)
      }
    } catch (error) {
      console.error('질문 및 답변 로드 오류:', error)
      alert('데이터를 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadQuestionAndAnswers()
  }, [selectedDate])

  /**
   * 답변 저장
   */
  const handleSaveAnswer = async () => {
    if (!question || !currentAnswer.trim()) {
      alert('답변을 입력해주세요.')
      return
    }

    setIsSaving(true)
    try {
      await saveAnswer(question.id, currentYear, currentAnswer.trim())
      await loadQuestionAndAnswers()
      alert('답변이 저장되었습니다.')
    } catch (error) {
      console.error('답변 저장 오류:', error)
      alert('답변 저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * 답변 삭제
   */
  const handleDeleteAnswer = async (answerId) => {
    if (!confirm('정말 삭제하시겠습니까?')) {
      return
    }

    try {
      await deleteAnswer(answerId)
      await loadQuestionAndAnswers()
      alert('답변이 삭제되었습니다.')
    } catch (error) {
      console.error('답변 삭제 오류:', error)
      alert('답변 삭제에 실패했습니다.')
    }
  }

  /**
   * 날짜 변경
   */
  const handleDateChange = (e) => {
    const newDate = new Date(e.target.value)
    setSelectedDate(newDate)
  }

  /**
   * 이전 날짜로 이동
   */
  const handlePrevDate = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }

  /**
   * 다음 날짜로 이동
   */
  const handleNextDate = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
  }

  /**
   * 오늘로 이동
   */
  const handleToday = () => {
    setSelectedDate(new Date())
  }

  /**
   * 연도 차이 계산
   */
  const getYearDiff = (year) => {
    const diff = currentYear - year
    if (diff === 0) return '올해'
    if (diff === 1) return '작년'
    return `${diff}년 전`
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-2xl text-gray-500 font-sans">로딩 중...</div>
        </div>
      </div>
    )
  }

  /**
   * 대시보드에서 날짜 클릭 핸들러
   */
  const handleDashboardDateClick = (date) => {
    setSelectedDate(date)
    setActiveTab('question')
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-800 font-sans">📖 5년 질문 일기</h1>
        <p className="text-base text-gray-600 font-sans mb-4">
          매일 하나의 질문에 답하며, 5년간의 변화를 기록하세요.
        </p>

        {/* 탭 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors font-sans ${
              activeTab === 'dashboard'
                ? 'bg-pink-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            대시보드
          </button>
          <button
            onClick={() => setActiveTab('question')}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors font-sans ${
              activeTab === 'question'
                ? 'bg-pink-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            질문 답변
          </button>
        </div>

        {/* 날짜 선택 (질문 답변 탭일 때만 표시) */}
        {activeTab === 'question' && (
          <>
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={handlePrevDate}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200"
              >
                ←
              </button>
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={handleDateChange}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg text-base focus:border-pink-400 focus:outline-none font-sans"
              />
              <button
                onClick={handleNextDate}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200"
              >
                →
              </button>
              <button
                onClick={handleToday}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-sm"
              >
                오늘
              </button>
            </div>
            <p className="text-lg text-gray-700 font-sans mb-4">{formatDate(selectedDate)}</p>
          </>
        )}
      </div>

      {/* 대시보드 탭 */}
      {activeTab === 'dashboard' && (
        <FiveYearQuestionDashboard onDateClick={handleDashboardDateClick} />
      )}

      {/* 질문 답변 탭 */}
      {activeTab === 'question' && question ? (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-6 border-2 border-pink-200 shadow-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-2 font-sans">오늘의 질문</h2>
            <p className="text-xl text-gray-700 font-sans leading-relaxed">{question.question_text}</p>
          </div>

          {/* 올해 답변 작성 */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-4 font-sans">
              {currentYear}년 답변 {editingAnswerId && <span className="text-sm text-gray-500">(수정 중)</span>}
            </h3>
            <textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              className="w-full p-4 border-2 border-gray-300 rounded-lg text-base focus:border-pink-400 focus:outline-none font-sans resize-none"
              rows="6"
              placeholder="오늘의 질문에 대한 답변을 작성해주세요..."
            />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={handleSaveAnswer}
                disabled={isSaving || !currentAnswer.trim()}
                className="px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors duration-200 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>

          {/* 과거 답변 목록 */}
          {answers.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4 font-sans">과거의 나</h3>
              <div className="space-y-4">
                {answers.map((answer) => {
                  const isCurrentYear = answer.year === currentYear
                  const yearDiff = getYearDiff(answer.year)
                  
                  return (
                    <div
                      key={answer.id}
                      className={`p-4 rounded-lg border-2 ${
                        isCurrentYear
                          ? 'bg-pink-50 border-pink-300 shadow-md'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold ${
                            isCurrentYear ? 'text-pink-600' : 'text-gray-600'
                          }`}>
                            {answer.year}년
                          </span>
                          <span className="text-sm text-gray-500">({yearDiff})</span>
                          {isCurrentYear && (
                            <span className="px-2 py-1 bg-pink-200 text-pink-700 rounded text-xs font-semibold">
                              올해
                            </span>
                          )}
                        </div>
                        {isCurrentYear && (
                          <button
                            onClick={() => handleDeleteAnswer(answer.id)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                      <p className="text-base text-gray-700 font-sans leading-relaxed whitespace-pre-wrap">
                        {answer.content}
                      </p>
                      {!isCurrentYear && answer.year === currentYear - 1 && (
                        <p className="text-sm text-gray-500 mt-2 font-sans italic">
                          💭 작년의 오늘 나는 이렇게 생각했어요
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 답변이 없을 때 안내 */}
          {answers.length === 0 && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
              <p className="text-base text-yellow-800 font-sans">
                아직 이 질문에 대한 답변이 없습니다. 첫 답변을 작성해보세요! 📝
              </p>
            </div>
          )}
        </div>
      ) : activeTab === 'question' && !question ? (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
          <p className="text-base text-red-800 font-sans">
            선택한 날짜에 대한 질문을 찾을 수 없습니다.
          </p>
        </div>
      ) : null}
    </div>
  )
}

