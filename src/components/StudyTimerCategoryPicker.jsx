import { useId } from 'react'
import {
  DEFAULT_STUDY_TIMER_CATEGORY,
  STUDY_TIMER_CATEGORIES,
} from '../constants/studyTimerCategories.js'

/**
 * 타이머 카테고리 선택 (책 / 공부 / 운동) — select
 * @param {{ value: string, onChange: (id: string) => void, disabled?: boolean, className?: string, label?: string }} props
 */
export default function StudyTimerCategoryPicker({
  value,
  onChange,
  disabled = false,
  className = '',
  label = '카테고리',
}) {
  const selected = value || DEFAULT_STUDY_TIMER_CATEGORY
  const selectId = useId()

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      <label htmlFor={selectId} className="text-xs font-medium text-gray-600">
        {label}
      </label>
      <select
        id={selectId}
        value={selected}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label="타이머 카테고리"
        className="min-w-[10rem] max-w-full rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {STUDY_TIMER_CATEGORIES.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.emoji} {cat.label}
          </option>
        ))}
      </select>
    </div>
  )
}
