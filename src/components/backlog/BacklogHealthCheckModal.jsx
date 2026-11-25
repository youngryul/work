import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BOTTLENECK_TYPE_CLASSES,
  BOTTLENECK_TYPE_LABELS,
  FOCUS_HEATMAP_STEP_CLASSES,
  HEATMAP_STEP_CLASSES,
  WEEKDAY_LABELS,
} from '../../constants/backlogHealthCheck.js'
import { TIME_SLOTS, getTimeSlotInfo } from '../../constants/timeSlots.js'
import { useAiTokenInfo } from '../../hooks/useAiTokenInfo.js'
import {
  formatShortDateLabel,
  getBacklogHealthHistory,
  loadLastBacklogHealthCheck,
  resolvePlanDate,
  runBacklogHealthCheck,
  scheduleBacklogTaskToSlot,
} from '../../services/backlogHealthCheckService.js'
import { deleteTask, moveToToday } from '../../services/taskService.js'
import { getCurrentUserIdSync } from '../../utils/authHelper.js'
import TokenDepositRequestModal from '../TokenDepositRequestModal.jsx'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/** 히트맵·표에서 쓰는 요일 표시 순서 (월~일) */
const DISPLAY_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]

/** 이 일수가 지나면 "다시 점검" 안내 */
const STALE_RESULT_DAYS = 7

/**
 * @param {number} timestamp
 * @returns {string}
 */
function formatCheckedAt(timestamp) {
  return new Date(timestamp).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 집중 시간(분) 짧게 표시: 90 → "1.5h", 40 → "40분"
 * @param {number} minutes
 */
function formatFocusMinutes(minutes) {
  if (minutes >= 60) return `${Math.round((minutes / 60) * 10) / 10}h`
  return `${minutes}분`
}

/**
 * 최댓값 대비 비율로 히트맵 색 단계 선택 (0은 0단계)
 * @param {number} value
 * @param {number} max
 * @param {number} stepCount
 */
function getHeatmapStep(value, max, stepCount) {
  if (!value || !max) return 0
  return Math.min(stepCount - 1, Math.max(1, Math.ceil((value / max) * (stepCount - 1))))
}

/* ───────────────────────── 작은 조각들 ───────────────────────── */

function Section({ icon, title, description, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-bold text-gray-800">
          <span aria-hidden="true">{icon}</span> {title}
        </h3>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * 지난 점검 대비 증감 (좋아진 방향은 초록, 나빠진 방향은 빨강 + 화살표)
 * @param {{ current: number | null, previous: number | null | undefined, betterWhen: 'up' | 'down' }} props
 */
function DeltaText({ current, previous, betterWhen }) {
  if (typeof current !== 'number' || typeof previous !== 'number') return null
  const diff = Math.round((current - previous) * 10) / 10
  if (diff === 0) return <p className="text-[11px] text-gray-500 mt-0.5">지난 점검과 같음</p>
  const improved = betterWhen === 'down' ? diff < 0 : diff > 0
  return (
    <p className={`text-[11px] font-semibold mt-0.5 ${improved ? 'text-green-700' : 'text-red-700'}`}>
      {diff > 0 ? '▲' : '▼'} {Math.abs(diff)}
      <span className="font-normal text-gray-500"> 지난 점검 대비</span>
    </p>
  )
}

function MetricTile({ label, value, unit, hint, delta }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 leading-tight mt-0.5">
        {value}
        {unit && <span className="text-sm font-medium text-gray-500 ml-0.5">{unit}</span>}
      </p>
      {hint && <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>}
      {delta}
    </div>
  )
}

/**
 * @param {{ snap: import('../../services/backlogHealthCheckService.js').BacklogHealthTaskRef }} props
 */
function TaskLabel({ snap }) {
  const flags = [`${snap.ageDays}일 대기`]
  if (snap.postponeCount > 0) flags.push(`미룸 ${snap.postponeCount}회`)
  else if (snap.bounced) flags.push('미룸')
  if (snap.overdue) flags.push('예약일 지남')
  return (
    <div className="min-w-0 flex-1">
      <p className="font-semibold text-gray-900 text-sm break-words">{snap.title}</p>
      <p className="text-xs text-gray-500 mt-0.5">
        {snap.category} · {flags.join(' · ')}
      </p>
    </div>
  )
}

/**
 * 할일 상태에 따라 버튼 또는 처리 완료 표시
 * @param {{ state: { status: string, label?: string }, onClick: () => void, busy: boolean, tone?: 'green' | 'red', children: import('react').ReactNode }} props
 */
function TaskActionButton({ state, onClick, busy, tone = 'green', children }) {
  if (state.status !== 'active') {
    return <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">✓ {state.label}</span>
  }
  const toneClass =
    tone === 'red'
      ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
      : 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg border whitespace-nowrap disabled:opacity-50 ${toneClass}`}
    >
      {children}
    </button>
  )
}

/**
 * 요일 × 시간대 히트맵 (칸 숫자가 표 역할, 호버·포커스 시 설명 표시)
 * @param {{
 *   cells: number[][],
 *   max: number,
 *   stepClasses: string[],
 *   formatValue: (value: number) => string,
 *   describe: (weekdayLabel: string, slotLabel: string, value: number) => string,
 * }} props
 */
function WeekdaySlotHeatmap({ cells, max, stepClasses, formatValue, describe }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `4.5rem repeat(${DISPLAY_WEEKDAYS.length}, minmax(0, 1fr))` }}
        onMouseLeave={() => setHovered(null)}
      >
        <div />
        {DISPLAY_WEEKDAYS.map((weekday) => (
          <div key={weekday} className="text-center text-xs font-semibold text-gray-600 pb-1">
            {WEEKDAY_LABELS[weekday]}
          </div>
        ))}

        {TIME_SLOTS.map((slot, slotIndex) => (
          <div key={slot.key} className="contents">
            <div className="flex items-center text-xs text-gray-600 pr-1">
              <span aria-hidden="true" className="mr-1">
                {slot.emoji}
              </span>
              {slot.label}
            </div>
            {DISPLAY_WEEKDAYS.map((weekday) => {
              const value = cells[weekday][slotIndex]
              const step = getHeatmapStep(value, max, stepClasses.length)
              const description = describe(WEEKDAY_LABELS[weekday], slot.label, value)
              return (
                <div
                  key={weekday}
                  tabIndex={0}
                  aria-label={description}
                  onMouseEnter={() => setHovered(description)}
                  onFocus={() => setHovered(description)}
                  className={`h-10 rounded flex items-center justify-center text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-gray-700 ${stepClasses[step]}`}
                >
                  {value > 0 ? formatValue(value) : ''}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
        <p className="text-xs text-gray-600 min-h-[1rem]">{hovered || '칸에 마우스를 올리면 자세히 보여요'}</p>
        <div className="flex items-center gap-1 text-[11px] text-gray-500" aria-hidden="true">
          적음
          {stepClasses.slice(1).map((className) => (
            <span key={className} className={`w-4 h-3 rounded-sm ${className}`} />
          ))}
          많음
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── 모달 ───────────────────────── */

/**
 * 백로그 점검 모달 (버튼을 눌렀을 때만 AI 점검 실행)
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   backlogTasks: Array,
 *   onTasksChanged: () => void,
 * }} props
 */
export default function BacklogHealthCheckModal({ open, onClose, backlogTasks = [], onTasksChanged }) {
  const { balance: tokenBalance, backlogAssistantCost, reload: reloadTokenInfo } = useAiTokenInfo()
  /** @type {[import('../../services/backlogHealthCheckService.js').BacklogHealthResult | null, Function]} */
  const [result, setResult] = useState(null)
  /** @type {[import('../../services/backlogHealthCheckService.js').BacklogHealthHistoryItem[], Function]} */
  const [history, setHistory] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState('')
  /** ref → 처리 결과 라벨 (예: "오늘 할일로 이동") */
  const [handled, setHandled] = useState({})
  const [busyRef, setBusyRef] = useState(null)
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  /** 패턴 히트맵 지표: completed(완료 수) | focus(집중 시간) */
  const [heatmapMode, setHeatmapMode] = useState('completed')

  const hasEnoughTokens = (tokenBalance ?? 0) >= (backlogAssistantCost ?? 1)
  const currentTaskIds = useMemo(() => new Set(backlogTasks.map((task) => task.id)), [backlogTasks])

  const loadHistory = useCallback(async () => {
    setHistory(await getBacklogHealthHistory())
  }, [])

  // 열 때 마지막 점검 결과(브라우저)와 점검 기록(DB)을 불러오기 — 토큰 사용 없음
  useEffect(() => {
    if (!open) return
    if (!result) setResult(loadLastBacklogHealthCheck(getCurrentUserIdSync()))
    loadHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handleRun = async () => {
    setIsRunning(true)
    setError('')
    try {
      const { result: nextResult, remainingBalance } = await runBacklogHealthCheck()
      setResult(nextResult)
      setHandled({})
      loadHistory()
      showToast(`점검 완료! 남은 토큰 ${remainingBalance}개`, TOAST_TYPES.SUCCESS)
    } catch (err) {
      setError(err.message || '백로그 점검에 실패했습니다.')
    } finally {
      setIsRunning(false)
    }
  }

  /**
   * 추천에 나온 할일의 현재 상태
   * @param {string} ref
   */
  const getTaskState = (ref) => {
    const snap = result?.taskRefs?.[ref]
    if (!snap) return { snap: null, status: 'missing' }
    if (handled[ref]) return { snap, status: 'handled', label: handled[ref] }
    if (!currentTaskIds.has(snap.id)) return { snap, status: 'gone', label: '이미 처리됨' }
    return { snap, status: 'active' }
  }

  /**
   * 할일 처리 공통 (중복 클릭 방지 + 처리 표시)
   * @param {string} ref
   * @param {(snap: Object) => Promise<string>} action - 처리 후 표시할 라벨 반환
   * @param {boolean} [notify]
   */
  const runTaskAction = async (ref, action, notify = true) => {
    const { snap, status } = getTaskState(ref)
    if (!snap || status !== 'active') return false
    setBusyRef(ref)
    try {
      const label = await action(snap)
      setHandled((prev) => ({ ...prev, [ref]: label }))
      if (notify) showToast(`「${snap.title}」 ${label}`, TOAST_TYPES.SUCCESS)
      return true
    } catch (err) {
      showToast(err.message || '처리에 실패했습니다.', TOAST_TYPES.ERROR)
      return false
    } finally {
      setBusyRef(null)
    }
  }

  const handleMoveToday = async (ref) => {
    const ok = await runTaskAction(ref, async (snap) => {
      await moveToToday(snap.id)
      return '오늘 할일로 이동'
    })
    if (ok) onTasksChanged?.()
  }

  const handleSchedule = (ref, weekday, timeSlot, notify = true) =>
    runTaskAction(
      ref,
      async (snap) => `${await scheduleBacklogTaskToSlot(snap.id, weekday, timeSlot)}에 배치`,
      notify,
    )

  /**
   * 칸(배치·묶음)의 할일 모두 배치
   * @param {{ weekday: number, timeSlot: string, taskRefs: string[] }} group
   */
  const handleScheduleAll = async (group) => {
    let count = 0
    // 같은 칸 안에서는 순서대로 처리 (오늘 할일 우선순위가 겹치지 않게)
    for (const ref of group.taskRefs) {
      if (getTaskState(ref).status !== 'active') continue
      // eslint-disable-next-line no-await-in-loop
      if (await handleSchedule(ref, group.weekday, group.timeSlot, false)) count += 1
    }
    if (count > 0) {
      showToast(`${count}개 할일을 배치했어요`, TOAST_TYPES.SUCCESS)
      onTasksChanged?.()
    }
  }

  const handleDelete = async (ref) => {
    const { snap } = getTaskState(ref)
    if (!snap) return
    if (!window.confirm(`「${snap.title}」 할일을 삭제할까요?\n삭제하면 되돌릴 수 없어요.`)) return
    const ok = await runTaskAction(ref, async (target) => {
      await deleteTask(target.id)
      return '삭제됨'
    })
    if (ok) onTasksChanged?.()
  }

  const stats = result?.stats
  const ai = result?.ai
  const trend = result?.trend
  const previous = trend?.previousMetrics || {}
  const isResultStale = result && Date.now() - result.checkedAt > STALE_RESULT_DAYS * 24 * 60 * 60 * 1000
  const hasFocusData = Boolean(stats?.focus?.totalMinutes)
  const activeHeatmapMode = hasFocusData ? heatmapMode : 'completed'
  const busyScheduleDays = (stats?.upcomingSchedule || []).filter((day) => day.count > 0)

  /** 날짜별 일정 개수 (배치 칸에 "일정 N개" 표시용) */
  const scheduleCountByDate = Object.fromEntries(
    (stats?.upcomingSchedule || []).map((day) => [day.dateString, day.count]),
  )

  /** 칸 목록에 실제 날짜를 붙여 날짜순 정렬 (예전 결과라도 항상 다가오는 날짜로 계산) */
  const withResolvedDates = (groups) =>
    (groups || [])
      .map((item) => ({ ...item, resolved: resolvePlanDate(item.weekday, item.timeSlot) }))
      .sort(
        (a, b) =>
          a.resolved.dateString.localeCompare(b.resolved.dateString) ||
          TIME_SLOTS.findIndex((slot) => slot.key === a.timeSlot) -
            TIME_SLOTS.findIndex((slot) => slot.key === b.timeSlot),
      )
  const sortedPlan = withResolvedDates(ai?.weeklyPlan)
  const sortedBatches = withResolvedDates(ai?.batches)

  /**
   * 배치·묶음 카드 (요일+시간대 한 칸)
   * @param {any} item - resolved(실제 날짜)가 붙은 칸
   * @param {string | null} title - 묶음 이름 (없으면 날짜·시간대를 제목으로)
   */
  const renderSlotGroup = (item, title) => {
    const slotInfo = getTimeSlotInfo(item.timeSlot)
    const hasActive = item.taskRefs.some((ref) => getTaskState(ref).status === 'active')
    const scheduleCount = scheduleCountByDate[item.resolved.dateString] || 0
    const slotLabel = (
      <>
        <span aria-hidden="true">{slotInfo.emoji}</span> {item.resolved.label}
      </>
    )
    return (
      <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-gray-900">{title || slotLabel}</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {title && slotLabel}
              {scheduleCount > 0 && (
                <span className={`${title ? 'ml-1.5 ' : ''}px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-700`}>
                  📅 이날 일정 {scheduleCount}개
                </span>
              )}
            </p>
            {item.reason && <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>}
          </div>
          {hasActive && item.taskRefs.length > 1 && (
            <button
              type="button"
              onClick={() => handleScheduleAll(item)}
              disabled={Boolean(busyRef)}
              className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              모두 배치
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {item.taskRefs.map((ref) => {
            const state = getTaskState(ref)
            if (!state.snap) return null
            return (
              <div key={ref} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5">
                <TaskLabel snap={state.snap} />
                <TaskActionButton
                  state={state}
                  busy={busyRef === ref}
                  onClick={async () => {
                    if (await handleSchedule(ref, item.weekday, item.timeSlot)) onTasksChanged?.()
                  }}
                >
                  배치
                </TaskActionButton>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="backlog-health-title"
          className="w-full max-w-3xl max-h-[90vh] bg-gray-50 rounded-2xl shadow-xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="shrink-0 bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="backlog-health-title" className="text-2xl font-bold text-white">
                🩺 백로그 점검
              </h2>
              <p className="text-sm text-white/90 mt-0.5">
                최근 90일 완료·집중 기록과 다가오는 일정으로 병목 할일과 나에게 맞는 요일·시간대를 찾아드려요
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white/90 hover:text-white text-2xl leading-none px-1"
              aria-label="점검 닫기"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6 min-h-0">
            {/* 실행 영역 */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-700">
                {result ? (
                  <>
                    마지막 점검: <span className="font-semibold">{formatCheckedAt(result.checkedAt)}</span>
                    {isResultStale && (
                      <span className="block text-xs text-amber-700 mt-0.5">
                        일주일 넘게 지났어요. 다시 점검하면 최신 기록으로 분석해요.
                      </span>
                    )}
                  </>
                ) : (
                  '아직 점검한 적이 없어요. 버튼을 누르면 점검을 시작해요.'
                )}
                <span className="block text-xs text-gray-500 mt-0.5">
                  점검 1회에 AI 토큰 {backlogAssistantCost}개 · 보유 {tokenBalance ?? '-'}개
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!hasEnoughTokens && (
                  <button
                    type="button"
                    onClick={() => setDepositModalOpen(true)}
                    className="px-3 py-2 text-sm rounded-xl border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100"
                  >
                    토큰 충전
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={isRunning || !hasEnoughTokens}
                  className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  {isRunning ? '점검 중...' : result ? '다시 점검' : '점검 시작'}
                </button>
              </div>
            </div>

            {isRunning && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                최근 기록과 백로그를 분석하고 있어요. 10~20초 정도 걸려요...
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}

            {!result && !isRunning && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600 space-y-1.5">
                <p className="font-semibold text-gray-800">점검하면 이런 걸 알려드려요</p>
                <p>· 오래 묵었거나 여러 번 미룬 병목 할일과 바로 할 수 있는 다음 행동</p>
                <p>· 카테고리별 쌓이는 속도와 소진 예상 기간</p>
                <p>· 내가 실제로 일을 끝내는 요일·시간대, 집중이 잘 되는 시간대</p>
                <p>· 다가오는 일정을 피한 이번 주 배치, 비슷한 할일 묶음 (버튼 한 번으로 예약)</p>
                <p>· 금방 끝낼 일, 정리(삭제)해도 될 일, 지난 점검 대비 변화</p>
              </div>
            )}

            {result && (
              <>
                {/* 요약 */}
                {(ai.summary || trend) && (
                  <div className="rounded-xl border-2 border-green-200 bg-white p-4 space-y-2">
                    {ai.summary && <p className="text-base text-gray-800 leading-relaxed">{ai.summary}</p>}
                    {trend && trend.previousBottleneckCount > 0 && (
                      <p className="text-sm text-gray-700">
                        🏁 {trend.daysSince === 0 ? '오늘' : `${trend.daysSince}일 전`} 점검의 병목{' '}
                        {trend.previousBottleneckCount}개 중{' '}
                        <b className="text-gray-900">{trend.resolvedBottleneckCount}개</b>가 백로그에서 빠졌어요
                        {trend.resolvedBottleneckCount > 0 ? ' 👏' : ''}
                      </p>
                    )}
                    {stats.dataIsSparse && (
                      <p className="text-xs text-amber-700">
                        최근 완료 기록이 {stats.completedInPeriod}건으로 적어서, 패턴보다 일반 원칙 위주로 추천했어요.
                      </p>
                    )}
                  </div>
                )}

                {/* 핵심 지표 (앱이 직접 계산) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <MetricTile
                    label="백로그"
                    value={stats.backlog.total}
                    unit="개"
                    hint={`평균 ${stats.backlog.avgAgeDays}일 대기`}
                    delta={<DeltaText current={stats.backlog.total} previous={previous.backlogTotal} betterWhen="down" />}
                  />
                  <MetricTile
                    label="2주 넘게 묵은 할일"
                    value={stats.backlog.staleTwoWeeks}
                    unit="개"
                    hint={`가장 오래된 할일 ${stats.backlog.oldestAgeDays}일`}
                    delta={
                      <DeltaText current={stats.backlog.staleTwoWeeks} previous={previous.staleTwoWeeks} betterWhen="down" />
                    }
                  />
                  <MetricTile
                    label="미뤄진 할일"
                    value={stats.backlog.bounced}
                    unit="개"
                    hint={
                      stats.backlog.repeatedPostpone
                        ? `3번 이상 미룬 할일 ${stats.backlog.repeatedPostpone}개`
                        : stats.backlog.overdueScheduled
                          ? `예약일 지난 할일 ${stats.backlog.overdueScheduled}개`
                          : '오늘 할일에서 돌아온 할일'
                    }
                    delta={<DeltaText current={stats.backlog.bounced} previous={previous.bounced} betterWhen="down" />}
                  />
                  <MetricTile
                    label="주당 완료"
                    value={stats.throughput.perWeek}
                    unit="개"
                    hint={`일한 날 하루 평균 ${stats.throughput.avgPerActiveDay}개`}
                    delta={<DeltaText current={stats.throughput.perWeek} previous={previous.perWeek} betterWhen="up" />}
                  />
                  <MetricTile
                    label="소진 예상"
                    value={stats.throughput.weeksToClear ?? '-'}
                    unit={stats.throughput.weeksToClear === null ? '' : '주'}
                    hint="지금 속도로 백로그를 비우는 데"
                    delta={
                      <DeltaText
                        current={stats.throughput.weeksToClear}
                        previous={previous.weeksToClear}
                        betterWhen="down"
                      />
                    }
                  />
                  <MetricTile
                    label="백로그 증감"
                    value={
                      stats.throughput.netPerWeek > 0
                        ? `+${stats.throughput.netPerWeek}`
                        : stats.throughput.netPerWeek
                    }
                    unit="개/주"
                    hint={
                      stats.throughput.netPerWeek > 0
                        ? '끝내는 것보다 더 많이 쌓이는 중'
                        : stats.throughput.netPerWeek < 0
                          ? '쌓이는 것보다 더 많이 끝내는 중'
                          : '들어오는 만큼 끝내는 중'
                    }
                  />
                </div>

                {/* 병목 할일 */}
                {ai.bottlenecks.length > 0 && (
                  <Section
                    icon="🚧"
                    title="병목 할일"
                    description="오래 묵었거나 여러 번 미룬 할일과 바로 할 수 있는 다음 행동이에요"
                  >
                    <div className="space-y-2">
                      {ai.bottlenecks.map((item) => {
                        const state = getTaskState(item.taskRef)
                        if (!state.snap) return null
                        return (
                          <div key={item.taskRef} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <TaskLabel snap={state.snap} />
                              <span
                                className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${BOTTLENECK_TYPE_CLASSES[item.type]}`}
                              >
                                {BOTTLENECK_TYPE_LABELS[item.type]}
                              </span>
                            </div>
                            {item.reason && <p className="text-xs text-gray-600">{item.reason}</p>}
                            <div className="flex items-start justify-between gap-2">
                              {item.action && (
                                <p className="text-sm text-green-900 bg-green-50 rounded-lg px-2.5 py-1.5 flex-1">
                                  👉 {item.action}
                                </p>
                              )}
                              <TaskActionButton
                                state={state}
                                busy={busyRef === item.taskRef}
                                onClick={() => handleMoveToday(item.taskRef)}
                              >
                                오늘 할일로
                              </TaskActionButton>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Section>
                )}

                {/* 카테고리 병목 */}
                {stats.categories.length > 0 && (
                  <Section
                    icon="🗂️"
                    title="카테고리별 흐름"
                    description={`최근 4주 처리 속도 기준이에요 · "잘 되는 때"는 최근 ${stats.lookbackDays}일 중 가장 많이 끝낸 요일·시간대`}
                  >
                    {ai.categoryBottleneck && (
                      <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        <span className="font-semibold">「{ai.categoryBottleneck.category}」가 가장 정체돼 있어요.</span>{' '}
                        {ai.categoryBottleneck.reason}
                      </p>
                    )}
                    <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-600">
                          <tr>
                            <th className="text-left font-semibold px-3 py-2">카테고리</th>
                            <th className="text-right font-semibold px-3 py-2">백로그</th>
                            <th className="text-right font-semibold px-3 py-2">평균 대기</th>
                            <th className="text-right font-semibold px-3 py-2">주당 완료</th>
                            <th className="text-right font-semibold px-3 py-2">소진 예상</th>
                            <th className="text-left font-semibold px-3 py-2">잘 되는 때</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.categories.map((cat) => {
                            const isBottleneck = ai.categoryBottleneck?.category === cat.category
                            const bestParts = [
                              cat.bestWeekday === null ? null : `${WEEKDAY_LABELS[cat.bestWeekday]}요일`,
                              cat.bestSlot ? getTimeSlotInfo(cat.bestSlot).label : null,
                            ].filter(Boolean)
                            return (
                              <tr
                                key={cat.category}
                                className={`border-t border-gray-100 ${isBottleneck ? 'bg-amber-50' : ''}`}
                              >
                                <td className="px-3 py-2 text-gray-900 font-medium">
                                  {cat.category}
                                  {isBottleneck && (
                                    <span className="ml-1.5 text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                      병목
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-800">{cat.backlogCount}개</td>
                                <td className="px-3 py-2 text-right text-gray-800">
                                  {cat.backlogCount ? `${cat.avgAgeDays}일` : '-'}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-800">{cat.perWeek}개</td>
                                <td className="px-3 py-2 text-right text-gray-800">
                                  {cat.weeksToClear === null
                                    ? cat.backlogCount
                                      ? '처리 기록 없음'
                                      : '-'
                                    : `${cat.weeksToClear}주`}
                                </td>
                                <td className="px-3 py-2 text-gray-700">{bestParts.join(' ') || '-'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Section>
                )}

                {/* 완료·집중 패턴 */}
                <Section
                  icon="📊"
                  title="내가 일을 끝내는 때"
                  description={
                    activeHeatmapMode === 'focus'
                      ? `최근 ${stats.lookbackDays}일 집중(공부·뽀모도로) ${stats.focus.sessionCount}회 · 총 ${formatFocusMinutes(stats.focus.totalMinutes)} · 세션 중간 시각 기준`
                      : `최근 ${stats.lookbackDays}일 동안 완료한 할일 ${stats.completedInPeriod}건 · 완료 시각 기준`
                  }
                >
                  {hasFocusData && (
                    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5" role="tablist">
                      {[
                        { key: 'completed', label: '✅ 완료 수' },
                        { key: 'focus', label: '⏱️ 집중 시간' },
                      ].map((mode) => (
                        <button
                          key={mode.key}
                          type="button"
                          role="tab"
                          aria-selected={activeHeatmapMode === mode.key}
                          onClick={() => setHeatmapMode(mode.key)}
                          className={`px-3 py-1 text-xs font-semibold rounded-md ${
                            activeHeatmapMode === mode.key ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {activeHeatmapMode === 'focus' ? (
                    <WeekdaySlotHeatmap
                      cells={stats.focus.cells}
                      max={stats.focus.max}
                      stepClasses={FOCUS_HEATMAP_STEP_CLASSES}
                      formatValue={formatFocusMinutes}
                      describe={(weekday, slot, value) =>
                        `${weekday}요일 ${slot} · 집중 ${value > 0 ? formatFocusMinutes(value) : '없음'}`
                      }
                    />
                  ) : (
                    <WeekdaySlotHeatmap
                      cells={stats.heatmap.cells}
                      max={stats.heatmap.max}
                      stepClasses={HEATMAP_STEP_CLASSES}
                      formatValue={(value) => String(value)}
                      describe={(weekday, slot, value) => `${weekday}요일 ${slot} · 완료 ${value}건`}
                    />
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-700">
                    {stats.leadTime.medianDays !== null && (
                      <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200">
                        만든 뒤 끝내기까지 보통 {stats.leadTime.medianDays}일
                      </span>
                    )}
                    {stats.leadTime.sameDayRate !== null && (
                      <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200">
                        당일 처리 {stats.leadTime.sameDayRate}%
                      </span>
                    )}
                    {stats.slotAdherence.rate !== null && (
                      <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200">
                        정한 시간대에 끝낸 비율 {stats.slotAdherence.rate}% ({stats.slotAdherence.onTime}/
                        {stats.slotAdherence.planned})
                      </span>
                    )}
                    {stats.postpone.avgPostponeBeforeDone !== null && (
                      <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200">
                        미뤘던 할일은 평균 {stats.postpone.avgPostponeBeforeDone}번 미룬 뒤 끝냄
                      </span>
                    )}
                  </div>
                  {ai.patternInsights.length > 0 && (
                    <ul className="space-y-1.5">
                      {ai.patternInsights.map((insight, index) => (
                        <li
                          key={`${index}-${insight}`}
                          className="text-sm text-gray-800 bg-white rounded-lg border border-gray-200 px-3 py-2"
                        >
                          💡 {insight}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                {/* 비슷한 할일 묶음 */}
                {sortedBatches.length > 0 && (
                  <Section
                    icon="🧺"
                    title="묶어서 처리하기"
                    description="성격이 비슷한 할일은 한 번에 몰아서 하면 전환 비용이 줄어요"
                  >
                    <div className="space-y-2">{sortedBatches.map((item) => renderSlotGroup(item, item.label))}</div>
                  </Section>
                )}

                {/* 이번 주 추천 배치 */}
                {sortedPlan.length > 0 && (
                  <Section
                    icon="🗓️"
                    title="이번 주 추천 배치"
                    description="오늘이면 바로 오늘 할일로, 다른 날이면 예약일·시간대가 지정돼 그날 자동으로 올라와요"
                  >
                    {busyScheduleDays.length > 0 && (
                      <p className="text-xs text-gray-600">
                        📅 다가오는 일정:{' '}
                        {busyScheduleDays
                          .map(
                            (day) =>
                              `${formatShortDateLabel(day.dateString)} ${day.count}개${
                                day.tags.length ? `(${day.tags.join(', ')})` : ''
                              }`,
                          )
                          .join(' · ')}
                      </p>
                    )}
                    <div className="space-y-2">{sortedPlan.map((item) => renderSlotGroup(item, null))}</div>
                  </Section>
                )}

                {/* 금방 끝낼 일 */}
                {ai.quickWins.length > 0 && (
                  <Section icon="⚡" title="15분이면 끝낼 일" description="작은 일부터 치우면 백로그 개수가 빠르게 줄어요">
                    <div className="space-y-1.5">
                      {ai.quickWins.map((item) => {
                        const state = getTaskState(item.taskRef)
                        if (!state.snap) return null
                        return (
                          <div
                            key={item.taskRef}
                            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <TaskLabel snap={state.snap} />
                              {item.reason && <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>}
                            </div>
                            <TaskActionButton
                              state={state}
                              busy={busyRef === item.taskRef}
                              onClick={() => handleMoveToday(item.taskRef)}
                            >
                              오늘 할일로
                            </TaskActionButton>
                          </div>
                        )
                      })}
                    </div>
                  </Section>
                )}

                {/* 정리 후보 */}
                {ai.cleanupCandidates.length > 0 && (
                  <Section
                    icon="🧹"
                    title="정리해도 될 것 같은 일"
                    description="오래 방치된 할일이에요. 더 이상 필요 없다면 지워서 백로그를 가볍게 해요"
                  >
                    <div className="space-y-1.5">
                      {ai.cleanupCandidates.map((item) => {
                        const state = getTaskState(item.taskRef)
                        if (!state.snap) return null
                        return (
                          <div
                            key={item.taskRef}
                            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <TaskLabel snap={state.snap} />
                              {item.reason && <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>}
                            </div>
                            <TaskActionButton
                              state={state}
                              busy={busyRef === item.taskRef}
                              tone="red"
                              onClick={() => handleDelete(item.taskRef)}
                            >
                              삭제
                            </TaskActionButton>
                          </div>
                        )
                      })}
                    </div>
                  </Section>
                )}

                {/* 추가 팁 */}
                {ai.tips.length > 0 && (
                  <Section icon="🌱" title="이런 방법도 있어요">
                    <ul className="space-y-1.5">
                      {ai.tips.map((tip, index) => (
                        <li
                          key={`${index}-${tip}`}
                          className="text-sm text-gray-800 bg-white rounded-lg border border-gray-200 px-3 py-2"
                        >
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </>
            )}

            {/* 점검 기록 (DB, 2회 이상일 때) */}
            {history.length >= 2 && (
              <Section icon="📈" title="점검 기록" description="점검할 때마다 핵심 지표가 쌓여요 · 최신순">
                <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-600">
                      <tr>
                        <th className="text-left font-semibold px-3 py-2">점검일</th>
                        <th className="text-right font-semibold px-3 py-2">백로그</th>
                        <th className="text-right font-semibold px-3 py-2">2주+ 묵음</th>
                        <th className="text-right font-semibold px-3 py-2">미룸</th>
                        <th className="text-right font-semibold px-3 py-2">주당 완료</th>
                        <th className="text-right font-semibold px-3 py-2">소진 예상</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((item) => (
                        <tr key={item.id} className="border-t border-gray-100" title={item.summary || undefined}>
                          <td className="px-3 py-2 text-gray-900">{formatCheckedAt(item.checkedAt)}</td>
                          <td className="px-3 py-2 text-right text-gray-800">{item.metrics.backlogTotal ?? '-'}개</td>
                          <td className="px-3 py-2 text-right text-gray-800">{item.metrics.staleTwoWeeks ?? '-'}개</td>
                          <td className="px-3 py-2 text-right text-gray-800">{item.metrics.bounced ?? '-'}개</td>
                          <td className="px-3 py-2 text-right text-gray-800">{item.metrics.perWeek ?? '-'}개</td>
                          <td className="px-3 py-2 text-right text-gray-800">
                            {typeof item.metrics.weeksToClear === 'number' ? `${item.metrics.weeksToClear}주` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}
          </div>
        </div>
      </div>

      {/* 배경 클릭 닫기(onClick)가 React 트리로 버블링되지 않도록 배경 div 바깥에 둔다 */}
      <TokenDepositRequestModal
        isOpen={depositModalOpen}
        onClose={() => {
          setDepositModalOpen(false)
          reloadTokenInfo()
        }}
        tokenBalance={tokenBalance}
        generationCost={backlogAssistantCost}
      />
    </>
  )
}
