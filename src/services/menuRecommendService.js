import {
  MENU_RECOMMEND_MAX_TOKENS,
  MENU_RECOMMEND_MENU_COUNT_MAX,
  MENU_RECOMMEND_MENU_COUNT_MIN,
  MENU_RECOMMEND_MODEL,
  MENU_RECOMMEND_SYSTEM_PROMPT,
} from '../constants/menuRecommend.js'
import { FRIDGE_STATUSES, getFridgeZoneLabel } from '../constants/fridgeInventory.js'
import {
  assertSufficientTokensForMenuRecommend,
  consumeTokensForMenuRecommend,
} from './aiTokenService.js'
import { getFridgeItems } from './fridgeInventoryService.js'

/**
 * @typedef {Object} RecommendedMenu
 * @property {string} id
 * @property {string} title
 * @property {string} reason
 * @property {string[]} usedIngredients
 * @property {string[]} missingIngredients
 * @property {string[]} steps
 */

/**
 * 보관중 재료 전체 조회
 * @returns {Promise<Array>}
 */
export async function getActiveFridgeIngredients() {
  return getFridgeItems({ status: FRIDGE_STATUSES.ACTIVE })
}

/**
 * @param {Array} items
 * @returns {string}
 */
export function buildMenuRecommendContext(items) {
  if (!items?.length) {
    return '보관중 재료가 없습니다.'
  }

  const lines = items.map((item) => {
    const zone = getFridgeZoneLabel(item.zone)
    const qty = item.quantity ?? 1
    const expiry = item.expires_at ? `유통기한 ${item.expires_at}` : '유통기한 없음'
    return `- [${zone}] ${item.name} ×${qty} (${expiry})`
  })

  return `보관중 재료 목록:\n${lines.join('\n')}`
}

/**
 * @param {string} content
 * @returns {Object}
 */
function parseRecommendJson(content) {
  const trimmed = content.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('AI 응답을 해석하지 못했습니다.')
    return JSON.parse(match[0])
  }
}

/**
 * @param {unknown} menus
 * @returns {RecommendedMenu[]}
 */
function normalizeMenus(menus) {
  if (!Array.isArray(menus)) return []

  return menus
    .map((item, index) => {
      const title = String(item?.title || '').trim()
      if (!title) return null

      const usedIngredients = Array.isArray(item?.usedIngredients)
        ? item.usedIngredients.map((name) => String(name).trim()).filter(Boolean)
        : []
      const missingIngredients = Array.isArray(item?.missingIngredients)
        ? item.missingIngredients.map((name) => String(name).trim()).filter(Boolean).slice(0, 3)
        : []
      const steps = Array.isArray(item?.steps)
        ? item.steps.map((step) => String(step).trim()).filter(Boolean).slice(0, 5)
        : []

      return {
        id: `menu-${Date.now()}-${index}`,
        title,
        reason: String(item?.reason || '').trim(),
        usedIngredients,
        missingIngredients,
        steps,
      }
    })
    .filter(Boolean)
    .slice(0, MENU_RECOMMEND_MENU_COUNT_MAX)
}

/**
 * 냉장고 재료 기반 메뉴 추천
 * @param {Array} [items] - 생략 시 보관중 전체 조회
 * @returns {Promise<{ menus: RecommendedMenu[], remainingBalance: number }>}
 */
export async function recommendMenusFromFridge(items) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다. (VITE_OPENAI_API_KEY)')
  }

  const ingredients = items ?? (await getActiveFridgeIngredients())
  if (!ingredients.length) {
    throw new Error('보관중 재료가 없습니다. 재료를 먼저 등록해 주세요.')
  }

  await assertSufficientTokensForMenuRecommend()

  const contextPrompt = buildMenuRecommendContext(ingredients)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MENU_RECOMMEND_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: MENU_RECOMMEND_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `아래 재고로 집밥 메뉴 ${MENU_RECOMMEND_MENU_COUNT_MIN}~${MENU_RECOMMEND_MENU_COUNT_MAX}개를 추천해 주세요.\n\n${contextPrompt}`,
        },
      ],
      max_tokens: MENU_RECOMMEND_MAX_TOKENS,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || '메뉴 추천에 실패했습니다.')
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 응답이 비어 있습니다.')

  const parsed = parseRecommendJson(content)
  const menus = normalizeMenus(parsed.menus)
  if (menus.length < 1) {
    throw new Error('추천 메뉴를 만들지 못했습니다. 다시 시도해 주세요.')
  }

  const remainingBalance = await consumeTokensForMenuRecommend()

  return { menus, remainingBalance }
}
