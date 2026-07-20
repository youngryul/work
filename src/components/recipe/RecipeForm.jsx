import { useEffect, useMemo, useState } from 'react'
import {
  RECIPE_INGREDIENT_CATEGORIES,
  RECIPE_INGREDIENT_CATEGORY_TABS,
  recipeIngredientCatalogKey,
} from '../../constants/recipe.js'
import {
  catalogIngredientExists,
  createCatalogIngredient,
  getRecipeCatalog,
} from '../../services/recipeCatalogService.js'
import {
  createRecipe,
  generateRecipeCoverImage,
  updateRecipe,
} from '../../services/recipeService.js'
import { RECIPE_IMAGE_GENERATION_TOKEN_COST } from '../../constants/aiTokenSettings.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import {
  IngredientPickerGrid,
} from './IngredientPicker.jsx'

/**
 * @param {Array} ingredients
 * @returns {Record<string, { quantity: number }>}
 */
function buildSelectedMap(ingredients) {
  /** @type {Record<string, { quantity: number }>} */
  const map = {}
  for (const line of ingredients || []) {
    if (line.catalog_id) {
      map[line.catalog_id] = {
        quantity: Number(line.quantity) || 1,
      }
    }
  }
  return map
}

/**
 * @param {Array} ingredients
 * @returns {string[]}
 */
function buildCustomNames(ingredients) {
  return (ingredients || [])
    .filter((line) => line.custom_name && !line.catalog_id)
    .map((line) => line.custom_name)
}

/**
 * 레시피 작성·수정 폼
 */
export default function RecipeForm({ recipe = null, onCancel, onSaved }) {
  const isEdit = Boolean(recipe?.id)
  const [catalog, setCatalog] = useState([])
  const [title, setTitle] = useState(recipe?.title || '')
  const [instructions, setInstructions] = useState(recipe?.instructions || '')
  const [imageUrl, setImageUrl] = useState(recipe?.image_url || null)
  const [imagePrompt, setImagePrompt] = useState(recipe?.image_prompt || null)
  const [selectedMap, setSelectedMap] = useState(() =>
    buildSelectedMap(recipe?.ingredients),
  )
  const [customLines, setCustomLines] = useState(() =>
    buildCustomNames(recipe?.ingredients),
  )
  const [customInput, setCustomInput] = useState('')
  const [activeCategory, setActiveCategory] = useState(RECIPE_INGREDIENT_CATEGORIES.SAUCE)
  const [saving, setSaving] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)

  useEffect(() => {
    getRecipeCatalog()
      .then(setCatalog)
      .catch((error) => {
        console.error(error)
        showToast(error.message || '재료 목록을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
      })
  }, [])

  const dedupedCatalog = useMemo(() => {
    const byKey = new Map()
    const sorted = [...catalog].sort((a, b) => {
      const aImg = a.image_url ? 1 : 0
      const bImg = b.image_url ? 1 : 0
      return bImg - aImg
    })
    for (const item of sorted) {
      const key = recipeIngredientCatalogKey(item.name, item.category)
      if (!byKey.has(key)) byKey.set(key, item)
    }
    return [...byKey.values()]
  }, [catalog])

  const toggleIngredient = (item) => {
    setSelectedMap((prev) => {
      const next = { ...prev }
      if (next[item.id]) {
        delete next[item.id]
      } else {
        next[item.id] = { quantity: 1 }
      }
      return next
    })
  }

  const changeQuantity = (item, quantity) => {
    setSelectedMap((prev) => ({
      ...prev,
      [item.id]: { quantity },
    }))
  }

  const addCustom = async () => {
    const name = customInput.trim()
    if (!name) return
    if (await catalogIngredientExists(name, RECIPE_INGREDIENT_CATEGORIES.OTHER, catalog)) {
      showToast('카탈로그에 같은 재료가 있습니다. 위 목록에서 선택해주세요.', TOAST_TYPES.ERROR)
      return
    }
    try {
      await createCatalogIngredient({
        name,
        category: RECIPE_INGREDIENT_CATEGORIES.OTHER,
        emoji: '🥗',
      })
      const refreshed = await getRecipeCatalog()
      setCatalog(refreshed)
      const added = refreshed.find(
        (item) =>
          item.category === RECIPE_INGREDIENT_CATEGORIES.OTHER &&
          item.name.trim().toLowerCase() === name.toLowerCase(),
      )
      if (added) {
        setSelectedMap((prev) => ({
          ...prev,
          [added.id]: { quantity: 1 },
        }))
      }
      setCustomInput('')
      showToast('재료가 추가되어 선택되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error(error)
      showToast(error.message || '재료 추가에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const buildIngredientsPayload = () => {
    const fromCatalog = Object.entries(selectedMap).map(([catalogId, meta], index) => ({
      catalogId,
      customName: null,
      quantity: meta.quantity || 1,
      sortOrder: index,
    }))
    const fromCustom = customLines.map((name, index) => ({
      catalogId: null,
      customName: name,
      quantity: 1,
      sortOrder: fromCatalog.length + index,
    }))
    return [...fromCatalog, ...fromCustom]
  }

  const handleGenerateImage = async () => {
    if (!title.trim()) {
      showToast('먼저 요리 제목을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    setGeneratingImage(true)
    try {
      const result = await generateRecipeCoverImage(title.trim())
      setImageUrl(result.imageUrl)
      setImagePrompt(result.imagePrompt)
      showToast('요리 이미지가 생성되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error(error)
      showToast(error.message || '이미지 생성에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      showToast('요리 제목을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        instructions,
        imageUrl,
        imagePrompt,
        ingredients: buildIngredientsPayload(),
      }
      const saved = isEdit
        ? await updateRecipe(recipe.id, payload)
        : await createRecipe(payload)
      showToast(isEdit ? '레시피가 수정되었습니다.' : '레시피가 저장되었습니다.', TOAST_TYPES.SUCCESS)
      onSaved?.(saved)
    } catch (error) {
      console.error(error)
      showToast(error.message || '저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-gray-800 text-sm font-semibold hover:bg-gray-50 shadow-sm w-full sm:w-auto shrink-0"
        >
          <span aria-hidden>←</span>
          목록으로
        </button>
        <h2 className="text-xl font-bold text-gray-900 sm:text-right">
          {isEdit ? '레시피 수정' : '새 레시피'}
        </h2>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">요리 제목</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base"
          placeholder="예: 간장계란밥"
          required
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-700">포실이 요리 이미지</span>
          <button
            type="button"
            onClick={handleGenerateImage}
            disabled={generatingImage}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
          >
            {generatingImage ? '그리는 중…' : imageUrl ? '다시 그리기' : 'AI로 그리기'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          생성 시 AI 토큰 {RECIPE_IMAGE_GENERATION_TOKEN_COST}개가 사용됩니다.
        </p>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title || '레시피 이미지'}
            className="w-full max-w-sm rounded-2xl border border-amber-100 object-cover aspect-square"
          />
        ) : (
          <div className="w-full max-w-sm aspect-square rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 flex items-center justify-center text-sm text-amber-800/70">
            제목을 넣고 AI로 손그림 이미지를 만들어보세요
          </div>
        )}
      </div>

      <div className="space-y-3">
        <span className="text-sm font-medium text-gray-700">재료 선택</span>
        <div className="flex gap-2 flex-wrap">
          {RECIPE_INGREDIENT_CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                activeCategory === tab.id
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          {activeCategory === RECIPE_INGREDIENT_CATEGORIES.SAUCE
            ? '소스를 누르면 선택되고, 몇 번 넣을지 조절할 수 있습니다.'
            : '재료 이미지를 누르면 레시피에 포함됩니다.'}
        </p>
        <IngredientPickerGrid
          catalog={dedupedCatalog}
          selectedMap={selectedMap}
          category={activeCategory}
          showQuantity={activeCategory === RECIPE_INGREDIENT_CATEGORIES.SAUCE}
          onToggle={toggleIngredient}
          onQuantityChange={changeQuantity}
        />
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium text-gray-700">카탈로그에 없는 재료</span>
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustom()
              }
            }}
            className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm"
            placeholder="이름 입력 후 추가 (전체 공용 목록에 등록)"
          />
          <button
            type="button"
            onClick={addCustom}
            className="px-3 py-2 rounded-xl border border-amber-300 text-amber-800 text-sm font-medium hover:bg-amber-50"
          >
            추가
          </button>
        </div>
        <p className="text-xs text-gray-500">
          기타 카테고리로 공용 재료에 추가되며, 같은 이름이 있으면 추가할 수 없습니다.
        </p>
        {customLines.length > 0 ? (
          <p className="text-xs text-gray-500">
            예전 형식으로만 저장된 재료: {customLines.join(', ')} (저장 시 유지됩니다)
          </p>
        ) : null}
      </div>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">조리법</span>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={8}
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm leading-relaxed"
          placeholder="순서대로 조리법을 적어주세요."
        />
      </label>

      <div className="flex gap-2 justify-end pb-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  )
}
