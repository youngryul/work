import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { isAdmin } from './adminService.js'
import {
  DEFAULT_AI_TOKEN_BALANCE,
  DEFAULT_AI_IMAGE_GENERATION_COST,
  DEFAULT_BACKLOG_ASSISTANT_COST,
  RECIPE_IMAGE_GENERATION_TOKEN_COST,
} from '../constants/aiTokenSettings.js'
import { notifyAiTokensUpdated } from '../utils/aiTokenEvents.js'

/**
 * @returns {Promise<{balance: number, generationCost: number, backlogAssistantCost: number, defaultBalance: number}>}
 */
export async function getMyAiTokenInfo() {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const { data, error } = await supabase.rpc('get_my_ai_token_info')
    if (error) throw error

    return {
      balance: data?.balance ?? DEFAULT_AI_TOKEN_BALANCE,
      generationCost: data?.generationCost ?? DEFAULT_AI_IMAGE_GENERATION_COST,
      backlogAssistantCost: data?.backlogAssistantCost ?? DEFAULT_BACKLOG_ASSISTANT_COST,
      defaultBalance: data?.defaultBalance ?? DEFAULT_AI_TOKEN_BALANCE,
    }
  } catch (error) {
    console.error('토큰 정보 조회 실패:', error)
    return {
      balance: DEFAULT_AI_TOKEN_BALANCE,
      generationCost: DEFAULT_AI_IMAGE_GENERATION_COST,
      backlogAssistantCost: DEFAULT_BACKLOG_ASSISTANT_COST,
      defaultBalance: DEFAULT_AI_TOKEN_BALANCE,
    }
  }
}

/**
 * AI 이미지 생성 가능 여부 확인
 * @returns {Promise<{balance: number, generationCost: number}>}
 */
export async function assertSufficientTokensForImageGeneration() {
  const info = await getMyAiTokenInfo()
  if (info.balance < info.generationCost) {
    throw new Error(
      `AI 이미지 생성 토큰이 부족합니다. (보유: ${info.balance}, 필요: ${info.generationCost})`,
    )
  }
  return info
}

/**
 * 이미지 생성 성공 후 토큰 차감
 * @returns {Promise<number>} 남은 토큰
 */
export async function consumeTokensForImageGeneration() {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data, error } = await supabase.rpc('consume_ai_tokens', {
    p_amount: null,
  })

  if (error) {
    console.error('토큰 차감 실패:', error)
    throw new Error(error.message || '토큰 차감에 실패했습니다.')
  }

  const remainingBalance = typeof data === 'number' ? data : Number(data)
  notifyAiTokensUpdated({ balance: remainingBalance })
  return remainingBalance
}

/**
 * 레시피 AI 이미지 생성 가능 여부 확인 (고정 5 토큰)
 * @returns {Promise<{balance: number, recipeImageCost: number}>}
 */
export async function assertSufficientTokensForRecipeImageGeneration() {
  const info = await getMyAiTokenInfo()
  const recipeImageCost = RECIPE_IMAGE_GENERATION_TOKEN_COST
  if (info.balance < recipeImageCost) {
    throw new Error(
      `AI 이미지 생성 토큰이 부족합니다. (보유: ${info.balance}, 필요: ${recipeImageCost})`,
    )
  }
  return { balance: info.balance, recipeImageCost }
}

/**
 * 레시피 AI 이미지 생성 성공 후 토큰 차감 (5 토큰)
 * @returns {Promise<number>} 남은 토큰
 */
export async function consumeTokensForRecipeImageGeneration() {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data, error } = await supabase.rpc('consume_ai_tokens', {
    p_amount: RECIPE_IMAGE_GENERATION_TOKEN_COST,
  })

  if (error) {
    console.error('토큰 차감 실패:', error)
    throw new Error(error.message || '토큰 차감에 실패했습니다.')
  }

  const remainingBalance = typeof data === 'number' ? data : Number(data)
  notifyAiTokensUpdated({ balance: remainingBalance })
  return remainingBalance
}

/**
 * 백로그 AI 어시스턴트 분석 가능 여부 확인
 * @returns {Promise<{balance: number, backlogAssistantCost: number}>}
 */
export async function assertSufficientTokensForBacklogAssistant() {
  const info = await getMyAiTokenInfo()
  if (info.balance < info.backlogAssistantCost) {
    throw new Error(
      `AI 토큰이 부족합니다. (보유: ${info.balance}, 필요: ${info.backlogAssistantCost})`,
    )
  }
  return {
    balance: info.balance,
    backlogAssistantCost: info.backlogAssistantCost,
  }
}

/**
 * 백로그 AI 어시스턴트 분석 성공 후 토큰 차감
 * @returns {Promise<number>} 남은 토큰
 */
export async function consumeTokensForBacklogAssistant() {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const { backlogAssistantCost } = await getMyAiTokenInfo()

  const { data, error } = await supabase.rpc('consume_ai_tokens', {
    p_amount: backlogAssistantCost,
  })

  if (error) {
    console.error('토큰 차감 실패:', error)
    throw new Error(error.message || '토큰 차감에 실패했습니다.')
  }

  const remainingBalance = typeof data === 'number' ? data : Number(data)
  notifyAiTokensUpdated({ balance: remainingBalance })
  return remainingBalance
}

/**
 * @returns {Promise<{defaultBalance: number, generationCost: number, backlogAssistantCost: number}>}
 */
export async function getAiTokenSettings() {
  try {
    const { data, error } = await supabase
      .from('ai_token_settings')
      .select('default_balance, generation_cost, backlog_assistant_cost')
      .eq('id', 1)
      .maybeSingle()

    if (error) throw error

    return {
      defaultBalance: data?.default_balance ?? DEFAULT_AI_TOKEN_BALANCE,
      generationCost: data?.generation_cost ?? DEFAULT_AI_IMAGE_GENERATION_COST,
      backlogAssistantCost: data?.backlog_assistant_cost ?? DEFAULT_BACKLOG_ASSISTANT_COST,
    }
  } catch (error) {
    console.error('토큰 설정 조회 실패:', error)
    return {
      defaultBalance: DEFAULT_AI_TOKEN_BALANCE,
      generationCost: DEFAULT_AI_IMAGE_GENERATION_COST,
      backlogAssistantCost: DEFAULT_BACKLOG_ASSISTANT_COST,
    }
  }
}

/**
 * 관리자: 전역 토큰 설정 변경
 * @param {{defaultBalance: number, generationCost: number, backlogAssistantCost: number}} params
 */
export async function updateAiTokenSettings({
  defaultBalance,
  generationCost,
  backlogAssistantCost,
}) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const admin = await isAdmin(userId)
  if (!admin) throw new Error('관리자 권한이 필요합니다.')

  const { data, error } = await supabase.rpc('admin_update_ai_token_settings', {
    p_default_balance: defaultBalance,
    p_generation_cost: generationCost,
    p_backlog_assistant_cost: backlogAssistantCost,
  })

  if (error) throw error
  const result = {
    defaultBalance: data?.defaultBalance ?? defaultBalance,
    generationCost: data?.generationCost ?? generationCost,
    backlogAssistantCost: data?.backlogAssistantCost ?? backlogAssistantCost,
  }
  notifyAiTokensUpdated({
    generationCost: result.generationCost,
    backlogAssistantCost: result.backlogAssistantCost,
  })
  return result
}

/**
 * 관리자: 특정 유저 토큰 잔액 설정
 * @param {string} targetUserId
 * @param {number} balance
 */
export async function setUserAiTokenBalance(targetUserId, balance) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const admin = await isAdmin(userId)
  if (!admin) throw new Error('관리자 권한이 필요합니다.')

  const { data, error } = await supabase.rpc('admin_set_user_ai_token_balance', {
    p_user_id: targetUserId,
    p_balance: balance,
  })

  if (error) throw error

  const currentUserId = await getCurrentUserId()
  if (targetUserId === currentUserId) {
    notifyAiTokensUpdated({ balance })
  }

  return data
}

/**
 * 관리자: 전체 유저 + 토큰 잔액
 * @param {Array<{userId: string, email: string}>} users
 * @returns {Promise<Array<{userId: string, email: string, balance: number}>>}
 */
export async function getTokenBalancesForUsers(users) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const admin = await isAdmin(userId)
  if (!admin) throw new Error('관리자 권한이 필요합니다.')

  const ids = users.map((u) => u.userId).filter(Boolean)
  if (ids.length === 0) return []

  const settings = await getAiTokenSettings()

  const { data, error } = await supabase
    .from('user_ai_tokens')
    .select('user_id, balance')
    .in('user_id', ids)

  if (error) throw error

  const balanceMap = new Map()
  ;(data || []).forEach((row) => balanceMap.set(row.user_id, row.balance))

  return users.map((u) => ({
    userId: u.userId,
    email: u.email,
    balance: balanceMap.has(u.userId) ? balanceMap.get(u.userId) : settings.defaultBalance,
  }))
}
