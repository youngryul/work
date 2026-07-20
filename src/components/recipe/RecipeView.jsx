import { useCallback, useEffect, useState } from 'react'
import { getRecipes, deleteRecipe } from '../../services/recipeService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import IngredientCatalogPanel from './IngredientCatalogPanel.jsx'
import RecipeForm from './RecipeForm.jsx'
import RecipeDetailView from './RecipeDetailView.jsx'
import {
  groupRecipeIngredientLines,
  RecipeIngredientChip,
} from './IngredientPicker.jsx'

/**
 * 레시피 목록 · 상세 · 작성 · 재료 관리
 */
export default function RecipeView() {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('list') // list | form | detail
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [showCatalog, setShowCatalog] = useState(false)

  const loadRecipes = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getRecipes()
      setRecipes(data)
      return data
    } catch (error) {
      console.error(error)
      const msg = error?.message || ''
      if (msg.includes('recipe') || msg.includes('schema cache') || error?.code === '42P01') {
        showToast(
          '레시피 테이블이 없습니다. Supabase에서 supabase-recipes.sql을 실행해주세요.',
          TOAST_TYPES.ERROR,
        )
      } else {
        showToast(msg || '레시피를 불러오지 못했습니다.', TOAST_TYPES.ERROR)
      }
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRecipes()
  }, [loadRecipes])

  const openCreate = () => {
    setEditing(null)
    setViewing(null)
    setMode('form')
  }

  const openEdit = (recipe, { keepDetailView = false } = {}) => {
    setEditing(recipe)
    if (keepDetailView) {
      setViewing(recipe)
    } else {
      setViewing(null)
    }
    setMode('form')
  }

  const openDetail = (recipe) => {
    setViewing(recipe)
    setEditing(null)
    setMode('detail')
  }

  const handleDelete = async (recipe) => {
    if (!window.confirm(`「${recipe.title}」 레시피를 삭제할까요?`)) return
    try {
      await deleteRecipe(recipe.id)
      showToast('레시피가 삭제되었습니다.', TOAST_TYPES.SUCCESS)
      setMode('list')
      setViewing(null)
      await loadRecipes()
    } catch (error) {
      console.error(error)
      showToast(error.message || '삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  if (mode === 'form') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <RecipeForm
          recipe={editing}
          onCancel={() => {
            setMode(viewing ? 'detail' : 'list')
            setEditing(null)
          }}
          onSaved={async () => {
            const data = await loadRecipes()
            const savedId = editing?.id
            setEditing(null)
            if (savedId) {
              const updated = data.find((r) => r.id === savedId)
              if (updated) {
                setViewing(updated)
                setMode('detail')
                return
              }
            }
            setMode('list')
            setViewing(null)
          }}
        />
      </div>
    )
  }

  if (mode === 'detail' && viewing) {
    const fresh = recipes.find((r) => r.id === viewing.id) || viewing
    return (
      <RecipeDetailView
        recipe={fresh}
        onBack={() => {
          setMode('list')
          setViewing(null)
        }}
        onEdit={(recipe) => openEdit(recipe, { keepDetailView: true })}
        onDelete={handleDelete}
      />
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">레시피</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            카드를 눌러 상세 레시피를 확인하세요.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCatalog(true)}
            className="px-3 py-2 rounded-xl border border-amber-300 text-amber-900 text-sm font-medium hover:bg-amber-50"
          >
            재료 관리
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600"
          >
            새 레시피
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-16">불러오는 중…</p>
      ) : recipes.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40">
          <p className="text-gray-700 font-medium">아직 레시피가 없습니다</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">첫 요리를 기록해보세요.</p>
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold"
          >
            레시피 만들기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recipes.map((recipe) => {
            const grouped = groupRecipeIngredientLines(recipe.ingredients)
            const chipLines = [
              ...grouped.sauces,
              ...grouped.produce,
              ...grouped.other,
            ]
            const preview =
              (recipe.instructions || '').trim().slice(0, 100) +
              ((recipe.instructions || '').trim().length > 100 ? '…' : '')

            return (
              <article
                key={recipe.id}
                role="button"
                tabIndex={0}
                onClick={() => openDetail(recipe)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openDetail(recipe)
                  }
                }}
                className="rounded-2xl border border-amber-100 bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-amber-200 transition-all flex flex-col cursor-pointer text-left"
              >
                <div className="aspect-[4/3] bg-amber-50 relative">
                  {recipe.image_url ? (
                    <img
                      src={recipe.image_url}
                      alt={recipe.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-amber-700/50 text-sm">
                      이미지 없음
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <h2 className="text-lg font-bold text-gray-900">{recipe.title}</h2>

                  {chipLines.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {chipLines.map((line) => (
                        <RecipeIngredientChip
                          key={line.id || `${line.catalog_id}-${line.custom_name}`}
                          line={line}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">재료 없음</p>
                  )}

                  {preview ? (
                    <p className="text-sm text-gray-600 whitespace-pre-wrap line-clamp-3 flex-1">
                      {preview}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 flex-1">조리법 없음</p>
                  )}

                  <p className="text-xs text-amber-700 font-medium pt-1">탭하여 상세 보기</p>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(recipe)
                      }}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(recipe)
                      }}
                      className="px-3 py-2 rounded-lg border border-red-100 text-sm text-red-600 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {showCatalog ? (
        <IngredientCatalogPanel
          onClose={() => setShowCatalog(false)}
          onChanged={loadRecipes}
        />
      ) : null}
    </div>
  )
}
