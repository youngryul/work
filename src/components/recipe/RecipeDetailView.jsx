import {
  getRecipeIngredientCategoryLabel,
  RECIPE_INGREDIENT_CATEGORIES,
} from '../../constants/recipe.js'
import {
  groupRecipeIngredientLines,
  RecipeIngredientDisplaySection,
} from './IngredientPicker.jsx'

/**
 * 레시피 상세 (조리법·재료·소스 이미지)
 */
export default function RecipeDetailView({
  recipe,
  onBack,
  onEdit,
  onDelete,
}) {
  if (!recipe) return null

  const grouped = groupRecipeIngredientLines(recipe.ingredients)
  const allLines = [
    ...grouped.sauces,
    ...grouped.produce,
    ...grouped.other,
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-gray-800 text-sm font-semibold hover:bg-gray-50 shadow-sm w-full sm:w-auto"
      >
        <span aria-hidden>←</span>
        목록으로
      </button>

      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">{recipe.title}</h1>
        <div className="rounded-2xl overflow-hidden border border-amber-100 bg-amber-50 aspect-[4/3] max-w-lg">
          {recipe.image_url ? (
            <img
              src={recipe.image_url}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-amber-700/50 text-sm min-h-[200px]">
              요리 이미지 없음
            </div>
          )}
        </div>
      </header>

      <div className="space-y-5">
        <RecipeIngredientDisplaySection title="소스" lines={grouped.sauces} />
        <RecipeIngredientDisplaySection title="야채·재료" lines={grouped.produce} />
        <RecipeIngredientDisplaySection
          title={getRecipeIngredientCategoryLabel(RECIPE_INGREDIENT_CATEGORIES.OTHER)}
          lines={grouped.other}
        />
        {allLines.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 재료가 없습니다.</p>
        ) : null}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-800">조리법</h2>
        {(recipe.instructions || '').trim() ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {recipe.instructions}
          </div>
        ) : (
          <p className="text-sm text-gray-400">조리법이 없습니다.</p>
        )}
      </section>

      <div className="flex gap-2 pb-4">
        <button
          type="button"
          onClick={() => onEdit?.(recipe)}
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-800 text-sm font-semibold hover:bg-gray-50"
        >
          수정
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(recipe)}
          className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50"
        >
          삭제
        </button>
      </div>
    </div>
  )
}
