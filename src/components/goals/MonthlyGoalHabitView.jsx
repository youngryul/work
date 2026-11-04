/**
 * 월별 목표 · 습관 트래커 통합 화면
 * - 월별 목표를 적고, "습관 트래커 필요"를 켠 목표는 바로 아래에 1일~말일 체크 트래커를 표시
 * - 목표에 연결되지 않은 습관은 '독립 습관'으로 따로 표시
 * - 지난달 미달성 목표 이월, 월말 회고(달성률 자동 채움) 포함
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getMonthlyGoalHabitBoard,
  updateMonthlyGoal,
  deleteMonthlyGoal,
  createHabitTracker,
  deleteHabitTracker,
  deleteHabitTrackersByMonthlyGoal,
  carryOverMonthlyGoals,
} from '../../services/goalService.js'
import { MONTHLY_GOAL_STATUS, MAX_MONTHLY_GOALS } from '../../constants/goalCategories.js'
import { getDaysInMonth } from '../../constants/habitTracker.js'
import { getGoalAchievementRate, summarizeMonthlyGoals } from '../../utils/monthlyGoalProgress.js'
import HabitTracker from './HabitTracker.jsx'
import HabitTrackerForm from './HabitTrackerForm.jsx'
import HabitTrackerSummary from './HabitTrackerSummary.jsx'
import MonthlyGoalForm from './MonthlyGoalForm.jsx'
import MonthlyReflectionForm from './MonthlyReflectionForm.jsx'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/** 다른 화면(점검 알림)에서 회고를 열어달라고 요청할 때 쓰는 키·이벤트 */
export const OPEN_MONTHLY_REFLECTION_KEY = 'posily_open_monthly_reflection'
export const OPEN_MONTHLY_REFLECTION_EVENT = 'openMonthlyGoalReflection'

/**
 * @param {number} year
 * @param {number} month
 * @param {number} delta - 이동할 개월 수
 */
function shiftMonth(year, month, delta) {
  const date = new Date(year, month - 1 + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

/** 이월 배너를 닫은 달 기록용 키 */
function carryOverDismissKey(year, month) {
  return `posily_monthly_goal_carry_dismissed_${year}-${month}`
}

export default function MonthlyGoalHabitView() {
  const today = new Date()
  const [{ year, month }, setYearMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  })
  const [goals, setGoals] = useState([])
  const [independentTrackers, setIndependentTrackers] = useState([])
  const [loading, setLoading] = useState(true)
  const [goalFormGoal, setGoalFormGoal] = useState(undefined) // undefined: 닫힘, null: 새 목표, 객체: 수정
  const [showHabitForm, setShowHabitForm] = useState(false)
  const [togglingGoalId, setTogglingGoalId] = useState(null)
  const [carryCandidates, setCarryCandidates] = useState([])
  const [carrySelection, setCarrySelection] = useState({})
  const [showCarryPicker, setShowCarryPicker] = useState(false)
  const [carrying, setCarrying] = useState(false)
  const [showReflection, setShowReflection] = useState(false)
  const [showLastMonthSummary, setShowLastMonthSummary] = useState(false)
  const reflectionRef = useRef(null)
  // 알림에서 회고 열기를 요청했을 때, 월 변경 effect가 회고를 다시 접지 않도록 표시
  const forceReflectionRef = useRef(false)
  const yearMonthRef = useRef({ year, month })
  yearMonthRef.current = { year, month }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth() + 1)
  const daysLeft = getDaysInMonth(year, month) - today.getDate()

  /**
   * 이번 달 목표·습관과 지난달 이월 후보를 불러온다.
   * @param {{ silent?: boolean }} [options] - silent면 로딩 화면 없이 갱신 (체크 후 새로고침용)
   */
  const loadBoard = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      const prev = shiftMonth(year, month, -1)
      const [board, prevBoard] = await Promise.all([
        getMonthlyGoalHabitBoard(year, month),
        getMonthlyGoalHabitBoard(prev.year, prev.month),
      ])
      setGoals(board.goals)
      setIndependentTrackers(board.independentTrackers)

      // 지난달 미완료 목표 중 이번 달에 같은 제목이 없는 것만 이월 후보
      const currentTitles = new Set(board.goals.map((g) => g.title.trim()))
      let dismissed = false
      try {
        dismissed = localStorage.getItem(carryOverDismissKey(year, month)) === '1'
      } catch {
        dismissed = false
      }
      const candidates = dismissed
        ? []
        : prevBoard.goals.filter(
          (g) => g.status !== MONTHLY_GOAL_STATUS.COMPLETED && !currentTitles.has(g.title.trim()),
        )
      setCarryCandidates(candidates)
      setCarrySelection(Object.fromEntries(candidates.map((g) => [g.id, true])))
    } catch (error) {
      console.error('월별 목표·습관 로드 실패:', error)
      showToast('월별 목표를 불러오지 못했어요.', TOAST_TYPES.ERROR)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    loadBoard()
  }, [loadBoard])

  // 말일 3일 전부터, 또는 지난 달을 볼 때는 회고 영역을 펼쳐 둔다
  useEffect(() => {
    setShowReflection(forceReflectionRef.current || isPastMonth || (isCurrentMonth && daysLeft <= 2))
    forceReflectionRef.current = false
  }, [year, month]) // eslint-disable-line react-hooks/exhaustive-deps

  // 매달 1일에는 지난달 습관 종합판을 한 번 보여준다 (기존 습관 트래커 화면 동작 유지)
  useEffect(() => {
    if (today.getDate() !== 1) return
    const key = `habitTrackerSummary_${today.getFullYear()}_${today.getMonth() + 1}`
    try {
      if (!localStorage.getItem(key)) {
        setShowLastMonthSummary(true)
        localStorage.setItem(key, 'true')
      }
    } catch {
      // ignore
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 점검 알림의 "회고 쓰기"로 들어온 경우 해당 달 회고를 펼친다
  useEffect(() => {
    const openReflection = ({ year: y, month: m }) => {
      const current = yearMonthRef.current
      if (current.year !== y || current.month !== m) {
        forceReflectionRef.current = true
        setYearMonth({ year: y, month: m })
      }
      setShowReflection(true)
      setTimeout(() => reflectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)
    }
    try {
      const pending = sessionStorage.getItem(OPEN_MONTHLY_REFLECTION_KEY)
      if (pending) {
        sessionStorage.removeItem(OPEN_MONTHLY_REFLECTION_KEY)
        openReflection(JSON.parse(pending))
      }
    } catch {
      // ignore
    }
    const handleEvent = (event) => {
      // 이미 화면이 열려 있어 이벤트로 처리했으면 다음 진입 때 다시 열리지 않도록 키 정리
      try {
        sessionStorage.removeItem(OPEN_MONTHLY_REFLECTION_KEY)
      } catch {
        // ignore
      }
      openReflection(event.detail)
    }
    window.addEventListener(OPEN_MONTHLY_REFLECTION_EVENT, handleEvent)
    return () => window.removeEventListener(OPEN_MONTHLY_REFLECTION_EVENT, handleEvent)
  }, [])

  const handleStatusToggle = async (goal) => {
    const nextStatus = goal.status === MONTHLY_GOAL_STATUS.COMPLETED
      ? MONTHLY_GOAL_STATUS.IN_PROGRESS
      : MONTHLY_GOAL_STATUS.COMPLETED
    try {
      await updateMonthlyGoal(goal.id, { status: nextStatus })
      if (nextStatus === MONTHLY_GOAL_STATUS.COMPLETED) {
        showToast(`'${goal.title}' 달성! 멋져요 🎉`, TOAST_TYPES.SUCCESS)
      }
      await loadBoard({ silent: true })
    } catch (error) {
      console.error('목표 상태 변경 실패:', error)
      showToast('상태 변경에 실패했어요.', TOAST_TYPES.ERROR)
    }
  }

  const handleDeleteGoal = async (goal) => {
    const message = goal.habitTrackers.length > 0
      ? `'${goal.title}' 목표와 연결된 습관 트래커까지 삭제할까요?`
      : `'${goal.title}' 목표를 삭제할까요?`
    if (!confirm(message)) return
    try {
      await deleteMonthlyGoal(goal.id)
      await loadBoard({ silent: true })
    } catch (error) {
      console.error('목표 삭제 실패:', error)
      showToast('삭제에 실패했어요.', TOAST_TYPES.ERROR)
    }
  }

  /** "습관 트래커 필요" 토글 — 켜면 트래커 생성, 끄면 연결된 트래커 삭제 */
  const handleHabitToggle = async (goal) => {
    const hasTracker = goal.habitTrackers.length > 0
    if (hasTracker) {
      const checkedDays = goal.habitTrackers.reduce(
        (acc, t) => acc + t.days.filter((d) => d.isCompleted).length,
        0,
      )
      const message = checkedDays > 0
        ? `체크한 ${checkedDays}일 기록이 함께 삭제돼요. 습관 트래커를 끌까요?`
        : '이 목표의 습관 트래커를 끌까요?'
      if (!confirm(message)) return
    }

    try {
      setTogglingGoalId(goal.id)
      if (hasTracker) {
        await deleteHabitTrackersByMonthlyGoal(goal.id)
      } else {
        await createHabitTracker({ monthlyGoalId: goal.id, year, month, title: goal.title })
      }
      await loadBoard({ silent: true })
    } catch (error) {
      console.error('습관 트래커 토글 실패:', error)
      showToast('습관 트래커 변경에 실패했어요.', TOAST_TYPES.ERROR)
    } finally {
      setTogglingGoalId(null)
    }
  }

  const handleDeleteIndependent = async (trackerId) => {
    if (!confirm('이 습관을 삭제할까요?')) return
    try {
      await deleteHabitTracker(trackerId)
      await loadBoard({ silent: true })
    } catch (error) {
      console.error('습관 삭제 실패:', error)
      showToast('삭제에 실패했어요.', TOAST_TYPES.ERROR)
    }
  }

  const handleCarryOver = async () => {
    const selected = carryCandidates.filter((g) => carrySelection[g.id])
    const slots = MAX_MONTHLY_GOALS - goals.length
    if (selected.length === 0) {
      showToast('이월할 목표를 골라주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (selected.length > slots) {
      showToast(`이번 달은 ${slots}개까지만 더 등록할 수 있어요.`, TOAST_TYPES.ERROR)
      return
    }
    try {
      setCarrying(true)
      const count = await carryOverMonthlyGoals(selected, year, month)
      showToast(`지난달 목표 ${count}개를 이월했어요. 이번 달엔 꼭!`, TOAST_TYPES.SUCCESS)
      setShowCarryPicker(false)
      await loadBoard({ silent: true })
    } catch (error) {
      console.error('목표 이월 실패:', error)
      showToast(error.message || '이월에 실패했어요.', TOAST_TYPES.ERROR)
      await loadBoard({ silent: true })
    } finally {
      setCarrying(false)
    }
  }

  const dismissCarryOver = () => {
    try {
      localStorage.setItem(carryOverDismissKey(year, month), '1')
    } catch {
      // ignore
    }
    setCarryCandidates([])
    setShowCarryPicker(false)
  }

  // 목표 등록/수정 폼
  if (goalFormGoal !== undefined) {
    return (
      <MonthlyGoalForm
        initialGoal={goalFormGoal}
        year={year}
        month={month}
        onSave={() => {
          setGoalFormGoal(undefined)
          loadBoard({ silent: true })
        }}
        onCancel={() => setGoalFormGoal(undefined)}
      />
    )
  }

  const summary = summarizeMonthlyGoals(goals, year, month)
  const prevMonth = shiftMonth(year, month, -1)

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-2 font-sans">월별 목표·습관</h1>
        <p className="text-base text-gray-600 font-sans">
          이번 달 목표를 적고, 매일 해야 하는 목표는 습관 트래커로 체크해보세요.
        </p>
      </div>

      {/* 월 이동 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setYearMonth(shiftMonth(year, month, -1))}
          className="px-3 py-2 rounded-lg border-2 border-green-200 bg-white hover:bg-green-50 font-sans"
          aria-label="이전 달"
        >
          ◀
        </button>
        <span className="min-w-[8rem] text-center text-lg font-bold text-gray-800 font-sans">
          {year}년 {month}월
        </span>
        <button
          type="button"
          onClick={() => setYearMonth(shiftMonth(year, month, 1))}
          className="px-3 py-2 rounded-lg border-2 border-green-200 bg-white hover:bg-green-50 font-sans"
          aria-label="다음 달"
        >
          ▶
        </button>
        {!isCurrentMonth && (
          <button
            type="button"
            onClick={() => setYearMonth({ year: today.getFullYear(), month: today.getMonth() + 1 })}
            className="px-3 py-2 rounded-lg text-sm text-green-700 hover:bg-green-50 font-sans"
          >
            이번 달로
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 font-sans">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p>로딩 중...</p>
        </div>
      ) : (
        <>
          {/* 요약 */}
          {goals.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <div className="rounded-lg border-2 border-green-200 bg-white p-4">
                <p className="text-xs text-gray-500 font-sans">완료한 목표</p>
                <p className="text-2xl font-bold text-gray-800 font-sans">
                  {summary.completedCount}<span className="text-base text-gray-400"> / {summary.totalCount}</span>
                </p>
              </div>
              <div className="rounded-lg border-2 border-green-200 bg-white p-4">
                <p className="text-xs text-gray-500 font-sans">
                  평균 달성률{isCurrentMonth ? ' (오늘까지)' : ''}
                </p>
                <p className="text-2xl font-bold text-green-600 font-sans">{summary.overallRate}%</p>
              </div>
            </div>
          )}

          {/* 지난달 미달성 목표 이월 */}
          {carryCandidates.length > 0 && goals.length < MAX_MONTHLY_GOALS && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 font-sans">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-amber-900">
                  {prevMonth.month}월에 못 이룬 목표가 <b>{carryCandidates.length}개</b> 있어요. 이번 달로 이어갈까요?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCarryPicker((v) => !v)}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 text-white text-sm font-medium hover:bg-amber-500"
                  >
                    {showCarryPicker ? '접기' : '이월하기'}
                  </button>
                  <button
                    type="button"
                    onClick={dismissCarryOver}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-900 text-sm hover:bg-amber-100"
                  >
                    괜찮아요
                  </button>
                </div>
              </div>
              {showCarryPicker && (
                <div className="mt-3 space-y-2">
                  {carryCandidates.map((goal) => (
                    <label key={goal.id} className="flex items-center gap-2 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        checked={!!carrySelection[goal.id]}
                        onChange={(e) => setCarrySelection((prev) => ({ ...prev, [goal.id]: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      <span>{goal.title}</span>
                      {goal.habitTrackers.length > 0 && (
                        <span className="text-xs text-amber-700">
                          (습관 트래커 함께 · 지난달 {getGoalAchievementRate(goal, prevMonth.year, prevMonth.month)}%)
                        </span>
                      )}
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={handleCarryOver}
                    disabled={carrying}
                    className="mt-1 px-4 py-1.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50"
                  >
                    {carrying ? '이월 중…' : '선택한 목표 이월'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 월별 목표 */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800 font-sans">{month}월 목표</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 font-sans">{goals.length} / {MAX_MONTHLY_GOALS}</span>
                {goals.length < MAX_MONTHLY_GOALS && (
                  <button
                    type="button"
                    onClick={() => setGoalFormGoal(null)}
                    className="px-4 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-sm font-medium shadow-md font-sans"
                  >
                    + 목표 추가
                  </button>
                )}
              </div>
            </div>

            {goals.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 font-sans">
                <p className="text-base text-gray-500 mb-2">{month}월 목표가 아직 없어요.</p>
                <p className="text-sm text-gray-400">이번 달에 이루고 싶은 것을 적어보세요.</p>
              </div>
            ) : (
              goals.map((goal) => {
                const isCompleted = goal.status === MONTHLY_GOAL_STATUS.COMPLETED
                const hasTracker = goal.habitTrackers.length > 0
                const rate = getGoalAchievementRate(goal, year, month)
                return (
                  <div key={goal.id} className="bg-white rounded-lg border-2 border-gray-200 p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={() => handleStatusToggle(goal)}
                          className="mt-1 w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          aria-label="목표 완료"
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className={`text-lg font-semibold font-sans ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                              {goal.title}
                            </span>
                            {goal.status === MONTHLY_GOAL_STATUS.PAUSED && (
                              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded font-sans">보류</span>
                            )}
                          </span>
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        {(hasTracker || isCompleted) && (
                          <span className="px-2 py-1 text-xs font-bold rounded bg-green-50 text-green-700 font-sans">
                            {rate}%
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setGoalFormGoal(goal)}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-sans"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGoal(goal)}
                          className="px-3 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200 font-sans"
                        >
                          삭제
                        </button>
                      </div>
                    </div>

                    {/* 습관 트래커 필요 토글 */}
                    <div className="mt-3 flex items-center gap-3 border-t border-gray-100 pt-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasTracker}
                          onChange={() => handleHabitToggle(goal)}
                          disabled={togglingGoalId === goal.id}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500 peer-disabled:opacity-50"></div>
                      </label>
                      <span className="text-sm text-gray-700 font-sans">
                        습관 트래커 {hasTracker ? '사용 중' : '필요해요'}
                      </span>
                    </div>

                    {/* 목표 바로 아래 습관 트래커 */}
                    {hasTracker && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {goal.habitTrackers.map((tracker) => (
                          <div key={tracker.id} className="w-full max-w-sm min-w-0">
                            <HabitTracker
                              tracker={tracker}
                              year={year}
                              month={month}
                              onUpdate={() => loadBoard({ silent: true })}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </section>

          {/* 독립 습관 (목표에 연결되지 않은 습관) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800 font-sans">독립 습관</h2>
                <p className="text-sm text-gray-500 font-sans">목표 없이 꾸준히 하고 싶은 습관</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHabitForm(true)}
                className="px-3 py-1.5 border-2 border-green-300 text-green-700 rounded-lg hover:bg-green-50 text-sm font-medium font-sans"
              >
                + 습관 추가
              </button>
            </div>
            {independentTrackers.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {independentTrackers.map((tracker) => (
                  <div key={tracker.id} className="relative w-full min-w-0">
                    <HabitTracker
                      tracker={tracker}
                      year={year}
                      month={month}
                      onUpdate={() => loadBoard({ silent: true })}
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteIndependent(tracker.id)}
                      className="absolute top-2 right-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/90 text-xs font-bold text-white shadow-md hover:bg-red-600 font-sans"
                      title="삭제"
                      aria-label="습관 삭제"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 월말 회고 */}
          <section ref={reflectionRef} className="space-y-3">
            <button
              type="button"
              onClick={() => setShowReflection((v) => !v)}
              className="flex items-center gap-2 text-xl font-bold text-gray-800 font-sans"
            >
              <span>{showReflection ? '▾' : '▸'}</span>
              {month}월 회고
              {isCurrentMonth && daysLeft <= 2 && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                  이번 달 마무리할 시간
                </span>
              )}
            </button>
            {showReflection && (
              <MonthlyReflectionForm
                year={year}
                month={month}
                suggestedAchievementRate={goals.length > 0 ? summary.overallRate : null}
              />
            )}
          </section>
        </>
      )}

      {showHabitForm && (
        <HabitTrackerForm
          year={year}
          month={month}
          onSave={() => {
            setShowHabitForm(false)
            loadBoard({ silent: true })
          }}
          onCancel={() => setShowHabitForm(false)}
        />
      )}

      {showLastMonthSummary && (
        <HabitTrackerSummary
          currentYear={today.getFullYear()}
          currentMonth={today.getMonth() + 1}
          onClose={() => setShowLastMonthSummary(false)}
        />
      )}
    </div>
  )
}
