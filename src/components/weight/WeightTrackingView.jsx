/**
 * 몸무게 기록 메인 뷰 — 포실이와 함께 체중 관리
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  saveWeightRecord,
  getWeightRecords,
  deleteWeightRecord,
  getWeightGoal,
  saveWeightGoal,
  getWeightSummary,
  calculateGoalProgress,
  getDateDaysAgo,
} from '../../services/weightTrackingService.js'
import {
  WEIGHT_POSILY_IMAGE,
  WEIGHT_UNIT,
  WEIGHT_CHART_PERIOD_OPTIONS,
  WEIGHT_CHART_DEFAULT_DAYS,
  WEIGHT_JELLY_HINT,
} from '../../constants/weightTracking.js'
import {
  JELLY_REWARD_WEIGHT_GOAL_REACHED,
  JELLY_REWARD_WEIGHT_RECORD,
} from '../../constants/jellyRewards.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import WeightChart from './WeightChart.jsx'
import WeightRecordList from './WeightRecordList.jsx'

export default function WeightTrackingView() {
  const today = new Date().toISOString().split('T')[0]

  const [records, setRecords] = useState([])
  const [goal, setGoal] = useState(null)
  const [summary, setSummary] = useState(null)
  const [chartDays, setChartDays] = useState(WEIGHT_CHART_DEFAULT_DAYS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingGoal, setIsSavingGoal] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const [recordDate, setRecordDate] = useState(today)
  const [weightInput, setWeightInput] = useState('')
  const [notes, setNotes] = useState('')

  const [targetWeightInput, setTargetWeightInput] = useState('')
  const [targetDateInput, setTargetDateInput] = useState('')
  const [showGoalForm, setShowGoalForm] = useState(false)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const startDate = getDateDaysAgo(chartDays)
      const [fetchedRecords, fetchedGoal, fetchedSummary] = await Promise.all([
        getWeightRecords({ startDate, endDate: today }),
        getWeightGoal(),
        getWeightSummary(startDate, today),
      ])
      setRecords(fetchedRecords)
      setGoal(fetchedGoal)
      setSummary(fetchedSummary)

      if (fetchedGoal) {
        setTargetWeightInput(String(fetchedGoal.targetWeightKg))
        setTargetDateInput(fetchedGoal.targetDate || '')
      }
    } catch (error) {
      console.error('몸무게 데이터 로드 실패:', error)
      showToast(error.message || '데이터를 불러오지 못했어요.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }, [chartDays, today])

  useEffect(() => {
    loadData()
  }, [loadData])

  const chartRecords = useMemo(
    () => [...records].sort((a, b) => a.recordDate.localeCompare(b.recordDate)),
    [records],
  )

  const latestWeight = summary?.latest?.weightKg ?? null
  const startWeight = summary?.earliest?.weightKg ?? latestWeight
  const goalProgress = calculateGoalProgress(
    latestWeight,
    goal?.targetWeightKg ?? null,
    startWeight,
  )

  const remainingToGoal =
    latestWeight && goal?.targetWeightKg
      ? Math.round((latestWeight - goal.targetWeightKg) * 10) / 10
      : null

  const posilyMessage = useMemo(() => {
    if (!latestWeight) return '오늘 몸무게를 기록하면 포실이가 젤리를 줄 거예요!'
    if (goalProgress >= 100) return '목표 달성! 포실이가 정말 기뻐해요 🎉'
    if (goalProgress >= 70) return '거의 다 왔어요! 조금만 더 힘내요!'
    if (goalProgress >= 30) return '꾸준히 잘하고 있어요, 화이팅!'
    if (summary?.change && summary.change < 0) return '좋은 방향으로 가고 있어요!'
    return '매일 기록하면 변화가 보여요!'
  }, [latestWeight, goalProgress, summary?.change])

  const handleSaveRecord = async (e) => {
    e.preventDefault()
    const weightKg = parseFloat(weightInput)
    if (!weightKg || weightKg <= 0) {
      showToast('올바른 몸무게를 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    setIsSaving(true)
    try {
      const result = await saveWeightRecord({
        recordDate,
        weightKg,
        notes: notes.trim(),
      })

      const totalJelly = (result.jellyAwarded || 0) + (result.goalJellyAwarded || 0)
      if (totalJelly > 0) {
        const parts = []
        if (result.jellyAwarded > 0) parts.push(`+${result.jellyAwarded}`)
        if (result.goalJellyAwarded > 0) parts.push(`목표 달성 +${result.goalJellyAwarded}`)
        showToast(`${parts.join(', ')} 젤리를 받았어요!`, TOAST_TYPES.SUCCESS)
      } else {
        showToast('몸무게가 저장되었어요!', TOAST_TYPES.SUCCESS)
      }

      if (recordDate === today) {
        setWeightInput('')
        setNotes('')
        setRecordDate(today)
      }

      await loadData()
    } catch (error) {
      showToast(error.message || '저장에 실패했어요.', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveGoal = async (e) => {
    e.preventDefault()
    const targetWeightKg = parseFloat(targetWeightInput)
    if (!targetWeightKg || targetWeightKg <= 0) {
      showToast('올바른 목표 몸무게를 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    setIsSavingGoal(true)
    try {
      const saved = await saveWeightGoal({
        targetWeightKg,
        targetDate: targetDateInput || null,
      })
      setGoal(saved)
      setShowGoalForm(false)
      showToast('목표가 저장되었어요!', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error.message || '목표 저장에 실패했어요.', TOAST_TYPES.ERROR)
    } finally {
      setIsSavingGoal(false)
    }
  }

  const handleDelete = async (recordId) => {
    if (!window.confirm('이 기록을 삭제할까요?')) return

    setDeletingId(recordId)
    try {
      await deleteWeightRecord(recordId)
      showToast('기록이 삭제되었어요.', TOAST_TYPES.INFO)
      await loadData()
    } catch (error) {
      showToast(error.message || '삭제에 실패했어요.', TOAST_TYPES.ERROR)
    } finally {
      setDeletingId(null)
    }
  }

  const changeLabel = summary?.change != null
    ? `${summary.change > 0 ? '+' : ''}${summary.change} ${WEIGHT_UNIT}`
    : '—'

  const changeColor = summary?.change == null
    ? 'text-gray-500'
    : summary.change < 0
      ? 'text-green-600'
      : summary.change > 0
        ? 'text-orange-600'
        : 'text-gray-600'

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* 헤더 — 포실이 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-100 via-amber-50 to-yellow-50 border-2 border-orange-200 shadow-lg">
        <div className="absolute -right-4 -top-4 w-32 h-32 bg-orange-200/30 rounded-full blur-2xl" />
        <div className="absolute -left-8 bottom-0 w-40 h-40 bg-yellow-200/40 rounded-full blur-2xl" />

        <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-6 sm:p-8">
          <div className="weight-posily-bounce shrink-0">
            <img
              src={WEIGHT_POSILY_IMAGE}
              alt="포실이"
              className="w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-lg select-none"
            />
          </div>
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-3xl sm:text-4xl font-bold text-orange-800 mb-1">
              몸무게 기록
            </h1>
            <p className="text-orange-700/80 text-sm sm:text-base mb-3">{posilyMessage}</p>
            <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs text-orange-700 border border-orange-200">
              <span>🍬</span>
              <span>{WEIGHT_JELLY_HINT}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white border-2 border-orange-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">현재</p>
          <p className="text-2xl font-bold text-orange-600 tabular-nums">
            {latestWeight ?? '—'}
            {latestWeight && <span className="text-sm font-medium text-orange-400 ml-0.5">{WEIGHT_UNIT}</span>}
          </p>
        </div>
        <div className="rounded-2xl bg-white border-2 border-orange-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">{chartDays}일 변화</p>
          <p className={`text-2xl font-bold tabular-nums ${changeColor}`}>{changeLabel}</p>
        </div>
        <div className="rounded-2xl bg-white border-2 border-green-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">목표</p>
          <p className="text-2xl font-bold text-green-600 tabular-nums">
            {goal?.targetWeightKg ?? '—'}
            {goal?.targetWeightKg && (
              <span className="text-sm font-medium text-green-400 ml-0.5">{WEIGHT_UNIT}</span>
            )}
          </p>
        </div>
        <div className="rounded-2xl bg-white border-2 border-amber-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">목표까지</p>
          <p className="text-2xl font-bold text-amber-600 tabular-nums">
            {remainingToGoal != null
              ? `${remainingToGoal > 0 ? '' : '+'}${Math.abs(remainingToGoal)}`
              : '—'}
            {remainingToGoal != null && (
              <span className="text-sm font-medium text-amber-400 ml-0.5">{WEIGHT_UNIT}</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">        {/* 입력 폼 */}
        <section className="rounded-2xl bg-white border-2 border-orange-100 p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>⚖️</span> 오늘 몸무게
          </h2>
          <form onSubmit={handleSaveRecord} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">날짜</label>
              <input
                type="date"
                value={recordDate}
                max={today}
                onChange={(e) => setRecordDate(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-orange-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 bg-orange-50/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                몸무게 ({WEIGHT_UNIT})
              </label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="500"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                placeholder="예: 65.5"
                className="w-full px-4 py-3 text-2xl font-bold border-2 border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-orange-700 tabular-nums"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">메모 (선택)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="운동 후, 아침 공복 등"
                className="w-full px-4 py-2.5 border-2 border-orange-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-md hover:from-orange-600 hover:to-amber-600 disabled:opacity-60 transition-all active:scale-[0.98]"
            >
              {isSaving ? '저장 중…' : `저장하고 젤리 +${JELLY_REWARD_WEIGHT_RECORD} 받기`}
            </button>
          </form>
        </section>

        {/* 목표 설정 */}
        <section className="rounded-2xl bg-white border-2 border-green-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span>🎯</span> 목표 몸무게
            </h2>
            {goal && !showGoalForm && (
              <button
                type="button"
                onClick={() => setShowGoalForm(true)}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                수정
              </button>
            )}
          </div>

          {goal && !showGoalForm ? (
            <div className="text-center py-6">
              <img
                src={WEIGHT_POSILY_IMAGE}
                alt=""
                className="w-16 h-16 mx-auto mb-3 opacity-80"
                aria-hidden
              />
              <p className="text-4xl font-bold text-green-600 tabular-nums">
                {goal.targetWeightKg}
                <span className="text-lg text-green-400 ml-1">{WEIGHT_UNIT}</span>
              </p>
              {goal.targetDate && (
                <p className="text-sm text-gray-500 mt-2">
                  {goal.targetDate.replace(/-/g, '.')} 까지
                </p>
              )}
              <p className="text-xs text-green-600 mt-4 bg-green-50 rounded-lg px-3 py-2 inline-block">
                달성 시 보너스 젤리 +{JELLY_REWARD_WEIGHT_GOAL_REACHED}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  목표 몸무게 ({WEIGHT_UNIT})
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="500"
                  value={targetWeightInput}
                  onChange={(e) => setTargetWeightInput(e.target.value)}
                  placeholder="예: 60"
                  className="w-full px-4 py-2.5 border-2 border-green-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-300"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">목표일 (선택)</label>
                <input
                  type="date"
                  value={targetDateInput}
                  min={today}
                  onChange={(e) => setTargetDateInput(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-green-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </div>
              <div className="flex gap-2">
                {goal && (
                  <button
                    type="button"
                    onClick={() => setShowGoalForm(false)}
                    className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50"
                  >
                    취소
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingGoal}
                  className="flex-1 py-2.5 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 disabled:opacity-60"
                >
                  {isSavingGoal ? '저장 중…' : '목표 저장'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {/* 그래프 */}
      <section className="rounded-2xl bg-gradient-to-b from-white to-orange-50/50 border-2 border-orange-100 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span>📈</span> 변화 그래프
          </h2>
          <div className="flex gap-1 bg-orange-100/60 rounded-lg p-1">
            {WEIGHT_CHART_PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setChartDays(opt.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  chartDays === opt.value
                    ? 'bg-white text-orange-700 shadow-sm'
                    : 'text-orange-600 hover:bg-white/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-gray-400">불러오는 중…</div>
        ) : (
          <WeightChart
            records={chartRecords}
            targetWeightKg={goal?.targetWeightKg ?? null}
          />
        )}
      </section>

      {/* 기록 목록 */}
      <section className="rounded-2xl bg-white border-2 border-orange-100 p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>📋</span> 최근 기록
        </h2>
        {isLoading ? (
          <p className="text-center text-gray-400 py-6">불러오는 중…</p>
        ) : (
          <WeightRecordList
            records={records}
            onDelete={handleDelete}
            isDeleting={deletingId}
          />
        )}
      </section>
    </div>
  )
}
