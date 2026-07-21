import { useState, useEffect } from 'react'
import {
  createDailyRoutine,
  deleteDailyRoutine,
  getDailyRoutines,
  updateDailyRoutine,
} from '../services/routineService.js'
import { getDefaultCategory, getCategoryEmoji } from '../services/categoryService.js'
import CategorySelector from './CategorySelector.jsx'
import { showToast, TOAST_TYPES } from './Toast.jsx'
import ViewPageTitle from './ViewPageTitle.jsx'

/**
 * 매일 오늘 할일로 자동 추가되는 루틴 관리 화면
 */
export default function RoutineView() {
  const [routines, setRoutines] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('회사')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [togglingId, setTogglingId] = useState('')
  const [categoryEmojis, setCategoryEmojis] = useState({})

  const loadRoutines = async () => {
    setIsLoading(true)
    try {
      const list = await getDailyRoutines()
      setRoutines(list)
      const emojiEntries = await Promise.all(
        list.map(async (routine) => {
          const emoji = await getCategoryEmoji(routine.category)
          return [routine.id, emoji]
        }),
      )
      setCategoryEmojis(Object.fromEntries(emojiEntries))
    } catch (error) {
      console.error('루틴 로드 오류:', error)
      showToast('루틴을 불러오지 못했습니다. DB 마이그레이션이 필요할 수 있습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const loadDefaultCategory = async () => {
      try {
        const defaultCat = await getDefaultCategory()
        setSelectedCategory(defaultCat)
      } catch {
        // ignore
      }
    }
    loadDefaultCategory()
    loadRoutines()
  }, [])

  const handleAddRoutine = async (e) => {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return

    setIsSaving(true)
    try {
      const created = await createDailyRoutine({
        title,
        category: selectedCategory,
        isEnabled: true,
      })
      const emoji = await getCategoryEmoji(created.category)
      setCategoryEmojis((prev) => ({ ...prev, [created.id]: emoji }))
      setRoutines((prev) => [...prev, created])
      setNewTitle('')
      showToast('루틴이 등록되었습니다. 오늘 할일에도 추가되었습니다.', TOAST_TYPES.SUCCESS)
      window.dispatchEvent(new CustomEvent('refreshTodayTasks'))
    } catch (error) {
      showToast(error.message || '루틴 등록에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleEnabled = async (routine) => {
    setTogglingId(routine.id)
    try {
      const updated = await updateDailyRoutine(routine.id, {
        isEnabled: !routine.isEnabled,
      })
      setRoutines((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (error) {
      showToast(error.message || '루틴 설정 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setTogglingId('')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('이 루틴을 삭제할까요?')) return
    setDeletingId(id)
    try {
      await deleteDailyRoutine(id)
      setRoutines((prev) => prev.filter((item) => item.id !== id))
      showToast('루틴을 삭제했습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error.message || '루틴 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setDeletingId('')
    }
  }

  const enabledCount = routines.filter((r) => r.isEnabled).length

  return (
    <div className="max-w-3xl mx-auto p-6">
      <ViewPageTitle icon="🔁" title="루틴">
        <p className="text-xl text-gray-600">
          등록한 루틴은 매일 오늘 할일 목록에 자동으로 추가됩니다.
          {enabledCount > 0 && ` (활성 ${enabledCount}개)`}
        </p>
      </ViewPageTitle>

      <form onSubmit={handleAddRoutine} className="mb-8">
        <div className="flex flex-col sm:flex-row gap-2">
          <CategorySelector
            selectedCategory={selectedCategory}
            onChange={setSelectedCategory}
            allowDailyCategory
          />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="예: 물 한 잔 마시기, 스트레칭 10분"
            className="flex-1 px-4 py-3 text-base border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400 shadow-sm font-sans"
          />
          <button
            type="submit"
            disabled={isSaving || !newTitle.trim()}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-semibold whitespace-nowrap"
          >
            {isSaving ? '추가 중...' : '루틴 추가'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          등록 즉시 오늘 할일에 추가되며, 이후에는 매일 자동으로 추가됩니다.
        </p>
      </form>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">로딩 중...</div>
      ) : routines.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          등록된 루틴이 없습니다. 위에서 추가해 보세요.
        </div>
      ) : (
        <ul className="space-y-3">
          {routines.map((routine) => (
            <li
              key={routine.id}
              className={`flex items-center gap-3 p-4 rounded-xl border shadow-sm ${
                routine.isEnabled
                  ? 'bg-white border-green-100'
                  : 'bg-gray-50 border-gray-200 opacity-80'
              }`}
            >
              <span className="text-2xl shrink-0" aria-hidden>
                {categoryEmojis[routine.id] || '📝'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-base text-gray-800 font-sans truncate">{routine.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {routine.category}
                  {routine.lastAppliedDate
                    ? ` · 마지막 반영: ${routine.lastAppliedDate}`
                    : ' · 아직 반영 전'}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={routine.isEnabled}
                  disabled={togglingId === routine.id}
                  onChange={() => handleToggleEnabled(routine)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-400"
                />
                사용
              </label>
              <button
                type="button"
                onClick={() => handleDelete(routine.id)}
                disabled={deletingId === routine.id}
                className="text-red-400 hover:text-red-600 text-2xl leading-none px-1 disabled:opacity-50"
                aria-label="삭제"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
