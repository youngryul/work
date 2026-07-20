/** 레시피 재료 카테고리 */
export const RECIPE_INGREDIENT_CATEGORIES = {
  SAUCE: 'sauce',
  PRODUCE: 'produce',
  OTHER: 'other',
}

/** 카테고리 탭 */
export const RECIPE_INGREDIENT_CATEGORY_TABS = [
  { id: RECIPE_INGREDIENT_CATEGORIES.SAUCE, label: '소스' },
  { id: RECIPE_INGREDIENT_CATEGORIES.PRODUCE, label: '야채·재료' },
  { id: RECIPE_INGREDIENT_CATEGORIES.OTHER, label: '기타' },
]

/**
 * @param {string} category
 * @returns {string}
 */
export function getRecipeIngredientCategoryLabel(category) {
  const tab = RECIPE_INGREDIENT_CATEGORY_TABS.find((item) => item.id === category)
  return tab?.label ?? category
}

/**
 * 재료 표시명 (카탈로그 또는 직접 입력)
 * @param {{ custom_name?: string|null, catalog?: { name?: string }|null, recipe_ingredient_catalog?: { name?: string }|null }} line
 * @returns {string}
 */
export function getRecipeIngredientDisplayName(line) {
  if (line?.custom_name?.trim()) return line.custom_name.trim()
  return (
    line?.catalog?.name ||
    line?.recipe_ingredient_catalog?.name ||
    '재료'
  )
}

/**
 * 카탈로그 중복 검사용 이름 정규화
 * @param {string} name
 * @returns {string}
 */
export function normalizeRecipeIngredientName(name) {
  return (name || '').trim().toLowerCase()
}

/**
 * @param {string} name
 * @param {string} category
 * @returns {string}
 */
export function recipeIngredientCatalogKey(name, category) {
  return `${category}::${normalizeRecipeIngredientName(name)}`
}
