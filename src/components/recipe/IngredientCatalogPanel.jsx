import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import {
  RECIPE_INGREDIENT_CATEGORIES,
  RECIPE_INGREDIENT_CATEGORY_TABS,
} from '../../constants/recipe.js'
import {
  catalogIngredientExists,
  createCatalogIngredient,
  deleteCatalogIngredient,
  getRecipeCatalog,
  uploadCatalogIngredientImage,
} from '../../services/recipeCatalogService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 재료 카탈로그 관리 (전체 공용 목록, 이미지는 관리자만)
 */
export default function IngredientCatalogPanel({ onClose, onChanged }) {
  const { isAdmin } = useAuth()
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState(RECIPE_INGREDIENT_CATEGORIES.SAUCE)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    emoji: '🥗',
    category: RECIPE_INGREDIENT_CATEGORIES.OTHER,
  })

  const load = async () => {
    setLoading(true)
    try {
      const data = await getRecipeCatalog()
      setCatalog(data)
    } catch (error) {
      console.error(error)
      showToast(error.message || '재료 목록을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const notifyChanged = async () => {
    await load()
    onChanged?.()
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) {
      showToast('재료 이름을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (await catalogIngredientExists(name, form.category, catalog)) {
      showToast('같은 카테고리에 동일한 재료가 이미 있습니다.', TOAST_TYPES.ERROR)
      return
    }
    setSaving(true)
    try {
      await createCatalogIngredient({
        name,
        emoji: form.emoji,
        category: form.category,
      })
      setForm({
        name: '',
        emoji: '🥗',
        category: form.category,
      })
      showToast('재료가 추가되었습니다. 모든 사용자에게 보입니다.', TOAST_TYPES.SUCCESS)
      await notifyChanged()
    } catch (error) {
      console.error(error)
      showToast(error.message || '재료 추가에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setSaving(false)
    }
  }

  const handleUploadImage = async (item, file) => {
    if (!file) return
    if (!isAdmin) {
      showToast('재료 이미지는 관리자만 등록할 수 있습니다.', TOAST_TYPES.ERROR)
      return
    }
    try {
      await uploadCatalogIngredientImage(item.id, file)
      showToast('이미지가 등록되었습니다.', TOAST_TYPES.SUCCESS)
      await notifyChanged()
    } catch (error) {
      console.error(error)
      showToast(error.message || '이미지 등록에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleDelete = async (item) => {
    if (!isAdmin) {
      showToast('재료 삭제는 관리자만 할 수 있습니다.', TOAST_TYPES.ERROR)
      return
    }
    if (!window.confirm(`「${item.name}」을(를) 삭제할까요?`)) return
    try {
      await deleteCatalogIngredient(item.id)
      showToast('재료가 삭제되었습니다.', TOAST_TYPES.SUCCESS)
      await notifyChanged()
    } catch (error) {
      console.error(error)
      showToast(error.message || '삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const filtered = catalog.filter((item) => item.category === activeCategory)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900">재료 관리</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-sm px-2 py-1"
          >
            닫기
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-4 border-b border-gray-100 space-y-3">
          <p className="text-sm text-gray-600">
            추가한 재료는 모든 사용자에게 공통으로 보입니다.
            {isAdmin ? ' 재료 이미지는 관리자만 등록할 수 있습니다.' : ' 이미지 등록은 관리자에게 요청해주세요.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-gray-700 font-medium">이름</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="예: 쪽파"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-700 font-medium">이모지</span>
              <input
                type="text"
                value={form.emoji}
                onChange={(e) => setForm((prev) => ({ ...prev, emoji: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                maxLength={8}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-gray-700 font-medium">카테고리</span>
              <select
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {RECIPE_INGREDIENT_CATEGORY_TABS.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-50"
          >
            {saving ? '추가 중…' : '재료 추가'}
          </button>
        </form>

        <div className="px-4 pt-3 flex gap-2 flex-wrap">
          {RECIPE_INGREDIENT_CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                activeCategory === tab.id
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-2">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-6">불러오는 중…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">이 카테고리에 재료가 없습니다.</p>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2 rounded-xl border border-gray-100"
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center border border-gray-100 shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{item.emoji || '🥗'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">공용 재료</p>
                </div>
                {isAdmin ? (
                  <>
                    <label className="text-xs text-amber-700 font-medium cursor-pointer hover:underline">
                      이미지
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          handleUploadImage(item, file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      삭제
                    </button>
                  </>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
