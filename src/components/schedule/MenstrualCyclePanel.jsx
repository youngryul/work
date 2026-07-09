import { useEffect, useState } from 'react'
import {
  DEFAULT_MENSTRUAL_CYCLE_LENGTH,
  DEFAULT_MENSTRUAL_PERIOD_LENGTH,
  MAX_MENSTRUAL_CYCLE_LENGTH,
  MAX_MENSTRUAL_PERIOD_LENGTH,
  MIN_MENSTRUAL_CYCLE_LENGTH,
  MIN_MENSTRUAL_PERIOD_LENGTH,
  MENSTRUAL_MARKER_TYPE,
} from '../../constants/menstrualCycle.js'
import {
  deletePeriodRecord,
  recordPeriodStart,
  saveMenstrualCycleSettings,
} from '../../services/menstrualCycleService.js'
import { findPeriodRecordForDate } from '../../utils/menstrualCycleCalendar.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 일정 달력 사이드 패널 — 생리 일정 관리
 * @param {{
 *   selectedDate: string,
 *   periodRecords: Array<{ id: string, startDate: string, endDate: string }>,
 *   cycleSettings: { cycleLength: number, periodLength: number } | null,
 *   onChanged: () => void | Promise<void>,
 *   formatSelectedDate: (dateString: string) => string,
 * }} props
 */
export default function MenstrualCyclePanel({
  selectedDate,
  periodRecords,
  cycleSettings,
  onChanged,
  formatSelectedDate,
}) {
  const [cycleLength, setCycleLength] = useState(DEFAULT_MENSTRUAL_CYCLE_LENGTH)
  const [periodLength, setPeriodLength] = useState(DEFAULT_MENSTRUAL_PERIOD_LENGTH)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [deletingRecordId, setDeletingRecordId] = useState('')

  useEffect(() => {
    setCycleLength(cycleSettings?.cycleLength ?? DEFAULT_MENSTRUAL_CYCLE_LENGTH)
    setPeriodLength(cycleSettings?.periodLength ?? DEFAULT_MENSTRUAL_PERIOD_LENGTH)
  }, [cycleSettings])

  const periodInfo = selectedDate ? findPeriodRecordForDate(periodRecords, selectedDate) : null
  const markerType = selectedDate
    ? periodInfo
      ? MENSTRUAL_MARKER_TYPE.RECORDED
      : null
    : null

  const handleSaveSettings = async () => {
    setIsSavingSettings(true)
    try {
      await saveMenstrualCycleSettings({
        cycleLength: Number(cycleLength),
        periodLength: Number(periodLength),
      })
      await onChanged()
      showToast('생리 주기 설정을 저장했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error?.message || '설정 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleRecordPeriodStart = async () => {
    if (!selectedDate) return
    setIsRecording(true)
    try {
      await recordPeriodStart(selectedDate)
      await onChanged()
      showToast('생리 시작일을 기록했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error?.message || '생리 시작일 기록에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsRecording(false)
    }
  }

  const handleDeletePeriod = async (recordId) => {
    setDeletingRecordId(recordId)
    try {
      await deletePeriodRecord(recordId)
      await onChanged()
      showToast('생리 기록을 삭제했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error?.message || '생리 기록 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setDeletingRecordId('')
    }
  }

  return (
    <section className="mt-6 pt-6 border-t border-gray-200">
      <h3 className="text-lg font-bold text-gray-800 mb-1">생리 일정</h3>
      <p className="text-xs text-gray-500 mb-4">
        시작일을 기록하면 달력에 표시되고, 주기에 따라 예상일도 보여줘요.
      </p>

      <div className="mb-4 rounded-xl border border-pink-200 bg-pink-50/60 p-3 space-y-3">
        <p className="text-sm font-semibold text-pink-900">주기 설정</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-gray-600">주기(일)</span>
            <input
              type="number"
              min={MIN_MENSTRUAL_CYCLE_LENGTH}
              max={MAX_MENSTRUAL_CYCLE_LENGTH}
              value={cycleLength}
              onChange={(e) => setCycleLength(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded-lg border border-pink-200 bg-white text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-600">생리 기간(일)</span>
            <input
              type="number"
              min={MIN_MENSTRUAL_PERIOD_LENGTH}
              max={MAX_MENSTRUAL_PERIOD_LENGTH}
              value={periodLength}
              onChange={(e) => setPeriodLength(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded-lg border border-pink-200 bg-white text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={isSavingSettings}
          className="w-full px-3 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700 disabled:opacity-50"
        >
          {isSavingSettings ? '저장 중...' : '주기 설정 저장'}
        </button>
      </div>

      {selectedDate && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            {formatSelectedDate(selectedDate)}
          </p>

          {periodInfo ? (
            <div className="space-y-2">
              <p className="text-sm text-pink-700">
                기록된 생리 기간
                {periodInfo.isStart ? ' (시작일)' : ''}
              </p>
              <p className="text-xs text-gray-500">
                {formatSelectedDate(periodInfo.record.startDate)} ~{' '}
                {formatSelectedDate(periodInfo.record.endDate)}
              </p>
              {periodInfo.isStart && (
                <button
                  type="button"
                  onClick={() => handleDeletePeriod(periodInfo.record.id)}
                  disabled={deletingRecordId === periodInfo.record.id}
                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingRecordId === periodInfo.record.id ? '삭제 중' : '이번 생리 기록 삭제'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">이 날짜에 기록된 생리 일정이 없습니다.</p>
              <button
                type="button"
                onClick={handleRecordPeriodStart}
                disabled={isRecording}
                className="w-full px-3 py-2 rounded-lg border border-pink-300 text-pink-700 text-sm font-medium hover:bg-pink-50 disabled:opacity-50"
              >
                {isRecording ? '기록 중...' : '이 날 생리 시작일로 기록'}
              </button>
            </div>
          )}

          {markerType === MENSTRUAL_MARKER_TYPE.RECORDED && !periodInfo?.isStart && (
            <p className="text-xs text-pink-600 mt-2">생리 기간 중인 날이에요.</p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-pink-200 border border-pink-300" />
          기록
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-pink-50 border border-dashed border-pink-300" />
          예상
        </span>
      </div>
    </section>
  )
}
