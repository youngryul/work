import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { SHOP_PURCHASE_TYPES } from '../constants/shop.js'

/**
 * @param {Object} row
 */
function normalizePurchaseRequest(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    depositorName: row.depositor_name,
    depositAmountKrw: row.deposit_amount_krw,
    purchaseType: row.purchase_type || SHOP_PURCHASE_TYPES.AI_TOKEN,
    requestedTokens: row.requested_tokens,
    requestedJelly: row.requested_jelly,
    status: row.status,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 무통장 충전 신청 제출
 * @param {{
 *   depositorName: string,
 *   depositAmountKrw: number,
 *   purchaseType?: 'ai_token' | 'jelly',
 *   requestedTokens?: number,
 *   requestedJelly?: number,
 *   userEmail?: string,
 * }} params
 */
export async function submitTokenPurchaseRequest(params) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const depositorName = (params.depositorName || '').trim()
  const depositAmountKrw = Number(params.depositAmountKrw)
  const purchaseType = params.purchaseType || SHOP_PURCHASE_TYPES.AI_TOKEN
  const requestedTokens = params.requestedTokens != null ? Number(params.requestedTokens) : null
  const requestedJelly = params.requestedJelly != null ? Number(params.requestedJelly) : null

  if (!depositorName) throw new Error('입금자명을 입력해주세요.')
  if (!Number.isFinite(depositAmountKrw) || depositAmountKrw <= 0) {
    throw new Error('입금 금액을 확인해주세요.')
  }

  if (purchaseType === SHOP_PURCHASE_TYPES.JELLY) {
    if (!Number.isFinite(requestedJelly) || requestedJelly <= 0) {
      throw new Error('신청 젤리 개수를 확인해주세요.')
    }
  } else if (!Number.isFinite(requestedTokens) || requestedTokens <= 0) {
    throw new Error('신청 토큰 개수를 확인해주세요.')
  }

  const insertRow = {
    user_id: userId,
    user_email: params.userEmail || null,
    depositor_name: depositorName,
    deposit_amount_krw: depositAmountKrw,
    purchase_type: purchaseType,
    status: 'pending',
  }

  if (purchaseType === SHOP_PURCHASE_TYPES.JELLY) {
    insertRow.requested_jelly = requestedJelly
    insertRow.requested_tokens = null
  } else {
    insertRow.requested_tokens = requestedTokens
    insertRow.requested_jelly = null
  }

  const { data, error } = await supabase
    .from('ai_token_purchase_requests')
    .insert([insertRow])
    .select('*')
    .single()

  if (error) {
    console.error('충전 신청 오류:', error)
    throw error
  }

  return normalizePurchaseRequest(data)
}

/**
 * 관리자: 전체 충전 신청 목록
 * @returns {Promise<Array>}
 */
export async function getAllTokenPurchaseRequests() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('ai_token_purchase_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('충전 신청 목록 조회 오류:', error)
    throw error
  }

  return (data || []).map(normalizePurchaseRequest)
}

/**
 * 관리자: 완료 처리 — 이메일로 사용자를 찾아 신청 수량을 잔액에 추가
 * @param {string} requestId
 */
export async function completeTokenPurchaseRequest(requestId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase.rpc('admin_complete_token_purchase_request', {
    p_request_id: requestId,
  })

  if (error) {
    console.error('충전 완료 처리 오류:', error)
    throw new Error(error.message || '완료 처리에 실패했습니다.')
  }

  const purchaseType = data?.purchaseType || SHOP_PURCHASE_TYPES.AI_TOKEN

  return {
    request: {
      id: data?.requestId ?? requestId,
      userId: data?.userId,
      userEmail: data?.email,
      purchaseType,
      requestedTokens: data?.addedTokens,
      requestedJelly: data?.addedJelly,
      status: data?.status ?? 'completed',
    },
    purchaseType,
    addedTokens: data?.addedTokens ?? 0,
    addedJelly: data?.addedJelly ?? 0,
    newBalance: data?.newBalance ?? 0,
    email: data?.email ?? null,
  }
}

/**
 * 관리자: 신청 상태 변경 (반려·대기 등, 완료는 completeTokenPurchaseRequest 사용)
 * @param {{ requestId: string, status: 'pending'|'completed'|'rejected', adminNote?: string }} params
 */
export async function updateTokenPurchaseRequestStatus(params) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  if (params.status === 'completed') {
    const result = await completeTokenPurchaseRequest(params.requestId)
    return {
      ...normalizePurchaseRequest({
        id: result.request.id,
        user_id: result.request.userId,
        user_email: result.request.userEmail,
        purchase_type: result.purchaseType,
        requested_tokens: result.request.requestedTokens,
        requested_jelly: result.request.requestedJelly,
        status: 'completed',
      }),
      purchaseType: result.purchaseType,
      addedTokens: result.addedTokens,
      addedJelly: result.addedJelly,
      newBalance: result.newBalance,
    }
  }

  const { data, error } = await supabase
    .from('ai_token_purchase_requests')
    .update({
      status: params.status,
      admin_note: params.adminNote?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.requestId)
    .select('*')
    .single()

  if (error) throw error
  return normalizePurchaseRequest(data)
}
