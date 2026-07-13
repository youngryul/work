import { useEffect, useMemo, useState } from 'react'
import { minuteToTimeLabel } from '../../services/travelItineraryService.js'

const HALF_HOUR_OPTIONS = Array.from({ length: 49 }, (_, i) => {
  const minute = i * 30
  return { minute, label: minuteToTimeLabel(minute) }
})

/**
 * @param {{
 *   isOpen: boolean,
 *   initialDate: string,
 *   initialStartMinute?: number,
 *   initialEndMinute?: number,
 *   editingItem?: object | null,
 *   onClose: () => void,
 *   onSubmit: (payload: object) => Promise<void>,
 *   onDelete?: () => Promise<void>,
 * }} props
 */
export default function TravelItineraryItemForm({
  isOpen,
  initialDate,
  initialStartMinute = 540,
  initialEndMinute = 570,
  editingItem = null,
  onClose,
  onSubmit,
  onDelete,
}) {
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [itemDate, setItemDate] = useState(initialDate)
  const [startMinute, setStartMinute] = useState(initialStartMinute)
  const [endMinute, setEndMinute] = useState(initialEndMinute)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    if (editingItem) {
      setTitle(editingItem.title || '')
      setMemo(editingItem.memo || '')
      setItemDate(editingItem.itemDate)
      setStartMinute(editingItem.startMinute)
      setEndMinute(editingItem.endMinute)
    } else {
      setTitle('')
      setMemo('')
      setItemDate(initialDate)
      setStartMinute(initialStartMinute)
      setEndMinute(initialEndMinute)
    }
  }, [isOpen, editingItem, initialDate, initialStartMinute, initialEndMinute])

  const startOptions = useMemo(
    () => HALF_HOUR_OPTIONS.filter((o) => o.minute < 1440),
    [],
  )
  const endOptions = useMemo(
    () => HALF_HOUR_OPTIONS.filter((o) => o.minute > startMinute),
    [startMinute],
  )

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await onSubmit({
        title,
        memo,
        itemDate,
        startMinute,
        endMinute,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-lg font-bold text-gray-800 font-sans">
            {editingItem ? '일정 수정' : '일정 추가'}
          </h3>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400" aria-label="닫기">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3 font-sans">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">제목 *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">날짜 *</span>
            <input
              type="date"
              value={itemDate}
              onChange={(e) => setItemDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-1 block">시작 *</span>
              <select
                value={startMinute}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  setStartMinute(next)
                  if (endMinute <= next) setEndMinute(Math.min(1440, next + 30))
                }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white"
              >
                {startOptions.map((o) => (
                  <option key={o.minute} value={o.minute}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-1 block">종료 *</span>
              <select
                value={endMinute}
                onChange={(e) => setEndMinute(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-white"
              >
                {endOptions.map((o) => (
                  <option key={o.minute} value={o.minute}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-1 block">메모</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </label>

          <div className="flex gap-2 pt-1">
            {editingItem && onDelete && (
              <button
                type="button"
                onClick={async () => {
                  setIsSaving(true)
                  try {
                    await onDelete()
                  } finally {
                    setIsSaving(false)
                  }
                }}
                className="px-3 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                disabled={isSaving}
              >
                삭제
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-sky-500 text-white font-semibold hover:bg-sky-600 disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

