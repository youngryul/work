import {
  RECIPE_INGREDIENT_CATEGORIES,
  RECIPE_INGREDIENT_CATEGORY_TABS,
  getRecipeIngredientDisplayName,
} from '../../constants/recipe.js'

/**
 * 수량 − / + 스테퍼
 */
export function RecipeQuantityStepper({
  value,
  onChange,
  min = 1,
  unit = '번',
  disabled = false,
}) {
  const current = Math.max(min, Number(value) || min)

  return (
    <div className="inline-flex items-center gap-1 select-none">
      <button
        type="button"
        disabled={disabled || current <= min}
        onClick={(e) => {
          e.stopPropagation()
          onChange(current - 1)
        }}
        className="w-7 h-7 rounded-lg border-2 border-amber-200 bg-white text-gray-700 font-semibold hover:bg-amber-50 disabled:opacity-40"
        aria-label="수량 줄이기"
      >
        −
      </button>
      <span className="min-w-[2.5rem] text-center text-sm font-semibold text-gray-800 tabular-nums">
        {current}
        {unit ? <span className="text-xs text-gray-500 ml-0.5">{unit}</span> : null}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          onChange(current + 1)
        }}
        className="w-7 h-7 rounded-lg border-2 border-amber-200 bg-white text-gray-700 font-semibold hover:bg-amber-50 disabled:opacity-40"
        aria-label="수량 늘리기"
      >
        +
      </button>
    </div>
  )
}

/**
 * 재료 타일 (이미지 또는 이모지)
 */
export function IngredientTile({
  item,
  selected = false,
  quantity = 1,
  showQuantity = false,
  onToggle,
  onQuantityChange,
}) {
  const hasImage = Boolean(item.image_url)

  return (
    <button
      type="button"
      onClick={() => onToggle?.(item)}
      className={`
        relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all text-center
        ${selected
          ? 'border-amber-500 bg-amber-50 shadow-sm ring-2 ring-amber-200'
          : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/40'}
      `}
    >
      <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center border border-gray-100">
        {hasImage ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-3xl leading-none" aria-hidden>
            {item.emoji || '🥗'}
          </span>
        )}
      </div>
      <span className="text-xs font-medium text-gray-800 line-clamp-2 w-full">
        {item.name}
      </span>
      {selected && showQuantity && onQuantityChange ? (
        <RecipeQuantityStepper
          value={quantity}
          onChange={(next) => onQuantityChange(item, next)}
          unit="번"
        />
      ) : null}
      {selected ? (
        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">
          ✓
        </span>
      ) : null}
    </button>
  )
}

/**
 * 카테고리별 재료 그리드
 */
export function IngredientPickerGrid({
  catalog,
  selectedMap,
  category,
  showQuantity = false,
  onToggle,
  onQuantityChange,
}) {
  const items = catalog.filter((item) => item.category === category)

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4 text-center">
        등록된 재료가 없습니다. 재료 관리에서 추가해보세요.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
      {items.map((item) => {
        const selected = selectedMap[item.id]
        return (
          <IngredientTile
            key={item.id}
            item={item}
            selected={Boolean(selected)}
            quantity={selected?.quantity ?? 1}
            showQuantity={showQuantity}
            onToggle={onToggle}
            onQuantityChange={onQuantityChange}
          />
        )
      })}
    </div>
  )
}

/**
 * 레시피 재료 라인에서 카탈로그 메타 추출
 * @param {object} line
 */
export function getRecipeIngredientCatalogMeta(line) {
  return line?.catalog || line?.recipe_ingredient_catalog || null
}

/**
 * @param {object} line
 * @returns {string}
 */
export function getRecipeIngredientCategoryFromLine(line) {
  const catalog = getRecipeIngredientCatalogMeta(line)
  if (catalog?.category) return catalog.category
  if (line?.custom_name && !line?.catalog_id) {
    return RECIPE_INGREDIENT_CATEGORIES.OTHER
  }
  return RECIPE_INGREDIENT_CATEGORIES.OTHER
}

/**
 * @param {Array} ingredients
 * @returns {{ sauces: object[], produce: object[], other: object[] }}
 */
export function groupRecipeIngredientLines(ingredients) {
  const sauces = []
  const produce = []
  const other = []

  for (const line of ingredients || []) {
    const category = getRecipeIngredientCategoryFromLine(line)
    if (line.custom_name && !line.catalog_id) {
      other.push(line)
    } else if (category === RECIPE_INGREDIENT_CATEGORIES.SAUCE) {
      sauces.push(line)
    } else if (category === RECIPE_INGREDIENT_CATEGORIES.PRODUCE) {
      produce.push(line)
    } else {
      other.push(line)
    }
  }

  return { sauces, produce, other }
}

/**
 * 레시피 카드용 재료 요약 텍스트 (레거시)
 * @param {Array} ingredients
 * @returns {{ sauces: string[], produce: string[], customs: string[] }}
 */
export function summarizeRecipeIngredients(ingredients) {
  const { sauces, produce, other } = groupRecipeIngredientLines(ingredients)
  const format = (line) => {
    const name = getRecipeIngredientDisplayName(line)
    const qty = Number(line.quantity) || 1
    const category = getRecipeIngredientCategoryFromLine(line)
    if (category === RECIPE_INGREDIENT_CATEGORIES.SAUCE && qty !== 1) {
      return `${name}×${qty}`
    }
    return name
  }
  return {
    sauces: sauces.map(format),
    produce: produce.map(format),
    customs: other.map(format),
  }
}

/**
 * 목록·상세 공통 재료 칩 (소스·재료 동일 스타일)
 */
export function RecipeIngredientChip({ line, size = 'sm' }) {
  const catalog = getRecipeIngredientCatalogMeta(line)
  const name = getRecipeIngredientDisplayName(line)
  const qty = Number(line.quantity) || 1
  const category = getRecipeIngredientCategoryFromLine(line)
  const isSauce = category === RECIPE_INGREDIENT_CATEGORIES.SAUCE
  const iconSize = size === 'sm' ? 'w-5 h-5 text-sm' : 'w-6 h-6 text-base'

  return (
    <span className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-white text-gray-800 text-xs border border-amber-200 shadow-sm">
      <span
        className={`${iconSize} rounded-full overflow-hidden bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100`}
      >
        {catalog?.image_url ? (
          <img src={catalog.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="leading-none" aria-hidden>
            {catalog?.emoji || '🥗'}
          </span>
        )}
      </span>
      <span className="font-medium">{name}</span>
      {isSauce ? (
        <span className="text-amber-700 font-semibold tabular-nums">{qty}번</span>
      ) : null}
    </span>
  )
}

/**
 * 상세 화면용 재료 타일 (읽기 전용, 이미지·이모지)
 */
export function RecipeIngredientDisplayTile({ line }) {
  const catalog = getRecipeIngredientCatalogMeta(line)
  const name = getRecipeIngredientDisplayName(line)
  const qty = Number(line.quantity) || 1
  const category = getRecipeIngredientCategoryFromLine(line)
  const isSauce = category === RECIPE_INGREDIENT_CATEGORIES.SAUCE

  return (
    <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-amber-100 bg-white text-center">
      <div className="w-16 h-16 rounded-full overflow-hidden bg-amber-50 flex items-center justify-center border border-amber-100">
        {catalog?.image_url ? (
          <img src={catalog.image_url} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl leading-none" aria-hidden>
            {catalog?.emoji || '🥗'}
          </span>
        )}
      </div>
      <span className="text-xs font-semibold text-gray-900 line-clamp-2 w-full">{name}</span>
      {isSauce ? (
        <span className="text-xs font-bold text-amber-700 tabular-nums">{qty}번</span>
      ) : null}
    </div>
  )
}

/**
 * 상세: 카테고리별 재료 그리드
 */
export function RecipeIngredientDisplaySection({ title, lines }) {
  if (!lines?.length) return null
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
        {lines.map((line) => (
          <RecipeIngredientDisplayTile key={line.id || `${line.catalog_id}-${line.custom_name}`} line={line} />
        ))}
      </div>
    </section>
  )
}

export { RECIPE_INGREDIENT_CATEGORY_TABS, RECIPE_INGREDIENT_CATEGORIES }
