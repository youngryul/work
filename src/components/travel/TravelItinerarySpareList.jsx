import { useCallback, useEffect, useState } from 'react'
import {
  createAbroadSpareItem,
  deleteAbroadSpareItem,
  getAbroadSpareItems,
  updateAbroadSpareItem,
} from '../../services/travelItineraryService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 날짜/시간 없이 제목만 적는 예비 일정
 * @param {{ tripId: string, onMoveToSchedule?: (item: object) => void }} props
 */
export default function TravelItinerarySpareList({ tripId, onMoveToSchedule }) {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [draftTitle, setDraftTitle] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const loadItems = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getAbroadSpareItems(tripId)
      setItems(data)
    } catch (error) {
      showToast(error?.message || '예비 일정을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handleAdd = async (event) => {
    event.preventDefault()
    if (!draftTitle.trim() || isSaving) return

    setIsSaving(true)
    try {
      const created = await createAbroadSpareItem({ tripId, title: draftTitle })
      setItems((prev) => [...prev, created])
      setDraftTitle('')
      showToast('예비 일정을 추가했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error?.message || '예비 일정 추가에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditingTitle(item.title)
  }

  const saveEdit = async () => {
    if (!editingId || isSaving) return
    const trimmed = editingTitle.trim()
    if (!trimmed) {
      showToast('예비 일정 제목을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    setIsSaving(true)
    try {
      const updated = await updateAbroadSpareItem(editingId, { title: trimmed })
      setItems((prev) => prev.map((row) => (row.id === editingId ? updated : row)))
      setEditingId(null)
      setEditingTitle('')
      showToast('예비 일정을 수정했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error?.message || '수정에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`「${item.title}」을(를) 삭제할까요?`)) return
    try {
      await deleteAbroadSpareItem(item.id)
      setItems((prev) => prev.filter((row) => row.id !== item.id))
      showToast('예비 일정을 삭제했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error?.message || '삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-800">
          예비 일정
          <span className="ml-2 text-sm font-normal text-gray-500">{items.length}건</span>
        </h2>
      </div>

      <p className="text-sm text-gray-500 mb-3">
        날짜·시간 없이 제목만 적어 두고, 나중에 일정에 옮길 후보를 모아 두세요.
      </p>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <input
          type="text"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="예: 근교 당일치기, 비 오면 박물관..."
          className="flex-1 px-3 py-2 border-2 border-sky-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300 text-sm"
        />
        <button
          type="submit"
          disabled={isSaving || !draftTitle.trim()}
          className="px-3 py-2 rounded-lg bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 disabled:opacity-50"
        >
          추가
        </button>
      </form>

      {isLoading ? (
        <p className="text-center text-gray-500 py-10">불러오는 중...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-gray-500">
          아직 예비 일정이 없습니다
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-white px-3 py-2.5"
            >
              <span className="text-xs font-semibold text-indigo-400 w-5 shrink-0">
                {index + 1}
              </span>
              {editingId === item.id ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      saveEdit()
                    }
                    if (e.key === 'Escape') {
                      setEditingId(null)
                    }
                  }}
                  className="flex-1 px-2 py-1 border border-indigo-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="flex-1 text-left text-sm font-medium text-gray-800"
                >
                  {item.title}
                </button>
              )}
              {editingId === item.id ? (
                <button
                  type="button"
                  onClick={saveEdit}
                  className="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                >
                  저장
                </button>
              ) : (
                <>
                  {onMoveToSchedule && (
                    <button
                      type="button"
                      onClick={() => onMoveToSchedule(item)}
                      className="text-xs px-2 py-1 rounded bg-sky-50 text-sky-700 hover:bg-sky-100"
                    >
                      일정으로
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                  >
                    삭제
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
