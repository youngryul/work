import { useEffect, useState } from 'react'
import {
  TIME_SLOTS,
  DEFAULT_TIME_SLOT_MINUTES,
  getTimeSlotTimes,
  isValidTimeSlotTimes,
  parseTimeText,
  formatMinutesAsTime,
  formatTimeSlotRange,
} from '../../constants/timeSlots.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 시간대 시작 시각 → 입력칸 텍스트
 * @param {{ morning: number, afternoon: number, evening: number }} times
 */
const toTimeTexts = (times) =>
  Object.fromEntries(TIME_SLOTS.map((slot) => [slot.key, formatMinutesAsTime(times[slot.key])]))

/**
 * 켜고 끄는 스위치 한 줄
 */
function ToggleRow({ title, description, checked, onChange, disabled = false }) {
  return (
    <label
      className={`flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <div className="min-w-0">
        <p className="text-base font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <span className="relative inline-flex items-center shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <span className="w-12 h-6 bg-gray-200 rounded-full peer peer-checked:bg-green-500 peer-checked:after:translate-x-6 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
      </span>
    </label>
  )
}

/**
 * 오늘 할 일 보기 설정 팝업
 * 시간대별 보기 · 지금 시간대만 보기 · 시간대 시작 시각을 한 번에 저장
 * @param {Object} props
 * @param {boolean} props.isSlotView - 현재 시간대별 보기 여부
 * @param {boolean} props.isFocusMode - 현재 지금 시간대만 보기 여부
 * @param {boolean} props.isAutoCarry - 현재 자동 이월 여부
 * @param {(settings: { isSlotView: boolean, isFocusMode: boolean, isAutoCarry: boolean, times: object }) => Promise<void>} props.onSave - 저장 (실패하면 throw)
 * @param {Function} props.onClose - 닫기
 */
export default function TodaySettingsModal({ isSlotView, isFocusMode, isAutoCarry, onSave, onClose }) {
  const [draftSlotView, setDraftSlotView] = useState(isSlotView)
  const [draftFocusMode, setDraftFocusMode] = useState(isFocusMode)
  const [draftAutoCarry, setDraftAutoCarry] = useState(isAutoCarry)
  const [timeTexts, setTimeTexts] = useState(() => toTimeTexts(getTimeSlotTimes()))
  const [isSaving, setIsSaving] = useState(false)

  // ESC로 닫기
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const parsedTimes = Object.fromEntries(
    TIME_SLOTS.map((slot) => [slot.key, parseTimeText(timeTexts[slot.key])]),
  )
  const hasFormatError = TIME_SLOTS.some((slot) => parsedTimes[slot.key] === null)
  const isValid = !hasFormatError && isValidTimeSlotTimes(parsedTimes)

  /**
   * 입력칸에서 벗어나면 "6:0" → 형식 맞으면 "06:00"처럼 정리
   */
  const handleTimeBlur = (key) => {
    const minutes = parseTimeText(timeTexts[key])
    if (minutes !== null) {
      setTimeTexts((prev) => ({ ...prev, [key]: formatMinutesAsTime(minutes) }))
    }
  }

  const handleSave = async () => {
    if (!isValid || isSaving) return
    setIsSaving(true)
    try {
      // 시간대별 보기를 끄면 지금 시간대만 보기 · 자동 이월도 함께 끔
      await onSave({
        isSlotView: draftSlotView,
        isFocusMode: draftSlotView && draftFocusMode,
        isAutoCarry: draftSlotView && draftAutoCarry,
        times: parsedTimes,
      })
      showToast('보기 설정을 저장했어요.', TOAST_TYPES.SUCCESS)
      onClose()
    } catch (error) {
      console.error('보기 설정 저장 오류:', error)
      showToast(error.message || '설정 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="today-settings-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 id="today-settings-title" className="text-xl font-bold text-gray-800">
            ⚙️ 오늘 할 일 보기 설정
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <ToggleRow
            title="🕒 시간대별 보기"
            description="할 일을 오전 · 오후 · 퇴근 후로 나눠서 보여줘요"
            checked={draftSlotView}
            onChange={setDraftSlotView}
          />
          <ToggleRow
            title="🎯 지금 시간대만 보기"
            description="지금 시간대와 '언제든' 할 일만 보여줘요"
            checked={draftSlotView && draftFocusMode}
            onChange={setDraftFocusMode}
            disabled={!draftSlotView}
          />
          <ToggleRow
            title="⏭️ 못 끝낸 할 일 자동 이월"
            description="지난 시간대에 남은 할 일을 지금 시간대로 자동으로 옮겨요"
            checked={draftSlotView && draftAutoCarry}
            onChange={setDraftAutoCarry}
            disabled={!draftSlotView}
          />

          <div className="p-3 rounded-lg bg-gray-50">
            <p className="text-base font-semibold text-gray-800">⏰ 시간대 시작 시각</p>
            <p className="text-xs text-gray-500 mt-0.5">
              00:00 형식으로 입력해요. 오전 시작 전 새벽은 전날 &lsquo;퇴근 후&rsquo;로 계산돼요.
            </p>

            <div className="mt-3 space-y-2">
              {TIME_SLOTS.map((slot) => {
                const isFieldError = parsedTimes[slot.key] === null
                return (
                  <div key={slot.key} className="flex items-center gap-3">
                    <label
                      htmlFor={`time-slot-${slot.key}`}
                      className="w-20 shrink-0 text-sm font-medium text-gray-700"
                    >
                      {slot.emoji} {slot.label}
                    </label>
                    <input
                      id={`time-slot-${slot.key}`}
                      type="text"
                      inputMode="numeric"
                      placeholder="00:00"
                      maxLength={5}
                      value={timeTexts[slot.key]}
                      onChange={(e) =>
                        setTimeTexts((prev) => ({ ...prev, [slot.key]: e.target.value }))
                      }
                      onBlur={() => handleTimeBlur(slot.key)}
                      aria-invalid={isFieldError}
                      className={`w-20 rounded-lg border px-2 py-1.5 text-center text-sm tabular-nums focus:outline-none ${
                        isFieldError
                          ? 'border-red-300 focus:border-red-400'
                          : 'border-gray-200 focus:border-green-400'
                      }`}
                    />
                    <span className="text-xs text-gray-500 tabular-nums">
                      {isValid ? `부터 · ${formatTimeSlotRange(slot.key, parsedTimes)}` : '부터'}
                    </span>
                  </div>
                )
              })}
            </div>

            {hasFormatError ? (
              <p className="mt-2 text-xs text-red-500">시각은 00:00 ~ 23:59 형식으로 입력해주세요.</p>
            ) : (
              !isValid && (
                <p className="mt-2 text-xs text-red-500">
                  오전 &lt; 오후 &lt; 퇴근 후 순서가 되도록 입력해주세요.
                </p>
              )
            )}

            <button
              type="button"
              onClick={() => setTimeTexts(toTimeTexts(DEFAULT_TIME_SLOT_MINUTES))}
              className="mt-2 text-xs text-gray-500 underline hover:text-gray-700"
            >
              기본 시각으로 (00:00 / 12:00 / 18:00)
            </button>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid || isSaving}
            className="flex-1 py-2.5 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
