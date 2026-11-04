/**
 * 월별 목표 10일 점검 모달
 * 10일 · 20일 · 말일에 목표별 달성률과 습관 실천율(페이스 · 스트릭)을 보여주고 독려한다.
 */
import { getPaceStatus } from '../../utils/monthlyGoalProgress.js'

const PACE_BAR_CLASS = {
  good: 'from-green-300 to-green-500',
  ok: 'from-amber-300 to-amber-500',
  low: 'from-red-300 to-red-400',
}

/**
 * @param {boolean} isOpen
 * @param {Object} reminder - fetchMonthlyGoalReminderPayload 결과 ({ year, month, checkpoint, isMonthEnd, summary, message })
 * @param {Function} onGoToGoals - 목표 화면으로 이동
 * @param {Function} onWriteReflection - 회고 쓰기 (말일에만 표시)
 * @param {Function} onClose
 */
export default function MonthlyGoalReminderModal({ isOpen, reminder, onGoToGoals, onWriteReflection, onClose }) {
  if (!isOpen || !reminder?.summary) return null

  const { month, checkpoint, isMonthEnd, summary, message } = reminder
  const title = isMonthEnd ? `${month}월 마무리 점검` : `${month}월 ${checkpoint}일 중간 점검`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col font-sans"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="p-5 border-b border-gray-100 bg-gradient-to-b from-green-50 to-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-green-700">🎯 월별 목표·습관</p>
              <h2 className="text-xl font-bold text-gray-800">{title}</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="닫기">
              ×
            </button>
          </div>
          <div className="mt-3 flex gap-4 text-sm">
            <span>완료 목표 <b className="text-gray-800">{summary.completedCount}/{summary.totalCount}</b></span>
            <span>평균 달성률 <b className="text-green-600">{summary.overallRate}%</b></span>
          </div>
          <p className="mt-2 text-sm text-gray-700">{message}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {summary.items.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className={`font-semibold ${item.isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {item.isCompleted ? '✅ ' : ''}{item.title}
                </p>
                <span className="text-sm font-bold text-green-700">{item.achievementRate}%</span>
              </div>

              {item.habits.length === 0 && !item.isCompleted && (
                <p className="mt-1 text-xs text-gray-500">
                  습관 트래커 없이 진행 중이에요. 매일 할 일이 있다면 트래커를 켜보세요.
                </p>
              )}

              {item.habits.map((habit) => {
                const pace = getPaceStatus(habit.paceRate)
                return (
                  <div key={habit.id} className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>📌 {habit.title}</span>
                      <span>
                        {habit.checkedDays}/{habit.elapsedDays}일 ({habit.paceRate}%)
                        {habit.streak > 0 && ` · 🔥${habit.streak}일 연속`}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${PACE_BAR_CLASS[pace.tone]}`}
                        style={{ width: `${habit.paceRate}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100 flex flex-wrap justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            닫기
          </button>
          {isMonthEnd && (
            <button
              onClick={onWriteReflection}
              className="px-4 py-2 bg-amber-400 text-white rounded-lg text-sm font-medium hover:bg-amber-500"
            >
              회고 쓰기
            </button>
          )}
          <button
            onClick={onGoToGoals}
            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600"
          >
            목표 보러 가기
          </button>
        </div>
      </div>
    </div>
  )
}
