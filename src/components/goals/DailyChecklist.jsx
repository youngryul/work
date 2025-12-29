/**
 * 일간 체크리스트 컴포넌트
 * 오늘 할 일을 체크리스트 형태로 표시
 */
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { getDailyChecks, toggleDailyCheck, createDailyCheck } from '../../services/goalService.js'

/**
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @param {Function} onComplete - 완료 핸들러
 */
export default function DailyChecklist({ date, onComplete }) {
  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(false)
  const [newCheckContent, setNewCheckContent] = useState('')

  // 체크리스트 로드
  useEffect(() => {
    loadChecks()
  }, [date])

  const loadChecks = async () => {
    try {
      setLoading(true)
      const data = await getDailyChecks(date)
      setChecks(data)
    } catch (error) {
      console.error('체크리스트 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  // 체크 토글
  const handleToggle = async (id, currentStatus) => {
    try {
      const updated = await toggleDailyCheck(id, !currentStatus)
      setChecks(prev => prev.map(check => 
        check.id === id ? updated : check
      ))
      
      // 완료 애니메이션 효과
      if (!currentStatus && onComplete) {
        onComplete(updated)
      }
    } catch (error) {
      console.error('체크 토글 실패:', error)
      alert('체크리스트 업데이트에 실패했습니다.')
    }
  }

  // 새 체크리스트 추가
  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newCheckContent.trim()) return

    try {
      const newCheck = await createDailyCheck({
        date,
        content: newCheckContent.trim(),
      })
      setChecks(prev => [...prev, newCheck])
      setNewCheckContent('')
    } catch (error) {
      console.error('체크리스트 추가 실패:', error)
      alert('체크리스트 추가에 실패했습니다.')
    }
  }

  // 날짜 포맷팅
  const formattedDate = format(new Date(date + 'T00:00:00'), 'yyyy년 MM월 dd일 (EEE)', { locale: ko })

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500 font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-400 mx-auto mb-2"></div>
        <p>로딩 중...</p>
      </div>
    )
  }

  const completedCount = checks.filter(c => c.isCompleted).length
  const totalCount = checks.length

  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-pink-200 p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 font-sans">오늘의 체크리스트</h2>
        <p className="text-base text-gray-600 font-sans">{formattedDate}</p>
        {totalCount > 0 && (
          <p className="text-sm text-gray-500 mt-2 font-sans">
            완료: {completedCount} / {totalCount}
          </p>
        )}
      </div>

      {/* 체크리스트 목록 */}
      <div className="space-y-3 mb-6">
        {checks.length === 0 ? (
          <div className="text-center py-8 text-gray-400 font-sans">
            <p className="text-base mb-2">등록된 체크리스트가 없습니다.</p>
            <p className="text-sm">아래에서 오늘 할 일을 추가해보세요.</p>
          </div>
        ) : (
          checks.map((check) => (
            <div
              key={check.id}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 ${
                check.isCompleted
                  ? 'bg-green-50 border-green-200 line-through text-gray-500'
                  : 'bg-white border-gray-200 hover:border-pink-300'
              }`}
            >
              <input
                type="checkbox"
                checked={check.isCompleted}
                onChange={() => handleToggle(check.id, check.isCompleted)}
                className="w-5 h-5 text-pink-600 rounded focus:ring-pink-500 cursor-pointer"
              />
              <span className={`flex-1 text-base font-sans ${
                check.isCompleted ? 'text-gray-400' : 'text-gray-800'
              }`}>
                {check.content}
              </span>
              {check.isCompleted && check.completedAt && (
                <span className="text-xs text-gray-400 font-sans">
                  {format(new Date(check.completedAt), 'HH:mm')}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* 새 체크리스트 추가 */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={newCheckContent}
          onChange={(e) => setNewCheckContent(e.target.value)}
          placeholder="오늘 할 일을 입력하세요..."
          className="flex-1 px-4 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors text-base font-medium shadow-md font-sans"
        >
          추가
        </button>
      </form>
    </div>
  )
}

