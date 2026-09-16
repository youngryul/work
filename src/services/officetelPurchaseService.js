import { supabase } from '../config/supabase.js'

/**
 * 오피스텔 매매 기록 목록 조회
 * @returns {Promise<Array>} 매물 기록 목록
 */
export async function getOfficetelPurchaseRecords() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_purchase_records')
    .select('*')
    .eq('user_id', user.id)
    .order('purchase_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * 오피스텔 매매 기록 저장
 * @param {Object} recordData
 * @param {string} recordData.property_name - 매물명
 * @param {string} [recordData.address] - 주소
 * @param {string} [recordData.purchase_date] - 매매일 (YYYY-MM-DD)
 * @param {number} recordData.sale_price - 매매가
 * @param {string} [recordData.memo] - 메모
 * @returns {Promise<Object>} 저장된 기록
 */
export async function saveOfficetelPurchaseRecord(recordData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_purchase_records')
    .insert({
      user_id: user.id,
      ...recordData,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 오피스텔 매매 기록 수정
 * @param {string} recordId
 * @param {Object} updates
 * @returns {Promise<Object>} 수정된 기록
 */
export async function updateOfficetelPurchaseRecord(recordId, updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_purchase_records')
    .update(updates)
    .eq('id', recordId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 오피스텔 매매 기록 삭제 (분담 내역, 기타 비용도 함께 삭제됨)
 * @param {string} recordId
 * @returns {Promise<void>}
 */
export async function deleteOfficetelPurchaseRecord(recordId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('officetel_purchase_records')
    .delete()
    .eq('id', recordId)
    .eq('user_id', user.id)

  if (error) throw error
}

/**
 * 전체 매물의 분담 합계 · 기타 비용 합계를 매물 ID 기준으로 조회
 * (목록 화면에서 N+1 쿼리 없이 합계를 표시하기 위함)
 * @returns {Promise<{ payerTotals: Record<string, number>, costTotals: Record<string, number> }>}
 */
export async function getOfficetelPurchaseTotals() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const [payersResult, costsResult] = await Promise.all([
    supabase.from('officetel_purchase_payers').select('purchase_id, amount').eq('user_id', user.id),
    supabase.from('officetel_purchase_costs').select('purchase_id, amount').eq('user_id', user.id),
  ])

  if (payersResult.error) throw payersResult.error
  if (costsResult.error) throw costsResult.error

  const sumBy = (rows) =>
    (rows || []).reduce((acc, row) => {
      acc[row.purchase_id] = (acc[row.purchase_id] || 0) + Number(row.amount)
      return acc
    }, {})

  return {
    payerTotals: sumBy(payersResult.data),
    costTotals: sumBy(costsResult.data),
  }
}

/**
 * 매물 분담 내역 조회
 * @param {string} purchaseId
 * @returns {Promise<Array>}
 */
export async function getOfficetelPurchasePayers(purchaseId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_purchase_payers')
    .select('*')
    .eq('user_id', user.id)
    .eq('purchase_id', purchaseId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * 매물 분담 내역 추가
 * @param {string} purchaseId
 * @param {Object} payerData - { payer_name, amount, memo }
 * @returns {Promise<Object>}
 */
export async function saveOfficetelPurchasePayer(purchaseId, payerData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_purchase_payers')
    .insert({
      user_id: user.id,
      purchase_id: purchaseId,
      ...payerData,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 매물 분담 내역 수정
 * @param {string} payerId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateOfficetelPurchasePayer(payerId, updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_purchase_payers')
    .update(updates)
    .eq('id', payerId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 매물 분담 내역 삭제
 * @param {string} payerId
 * @returns {Promise<void>}
 */
export async function deleteOfficetelPurchasePayer(payerId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('officetel_purchase_payers')
    .delete()
    .eq('id', payerId)
    .eq('user_id', user.id)

  if (error) throw error
}

/**
 * 매물 기타 비용 조회 (복비, 법무사비 등)
 * @param {string} purchaseId
 * @returns {Promise<Array>}
 */
export async function getOfficetelPurchaseCosts(purchaseId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_purchase_costs')
    .select('*')
    .eq('user_id', user.id)
    .eq('purchase_id', purchaseId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * 매물 기타 비용 추가
 * @param {string} purchaseId
 * @param {Object} costData - { category, amount, memo }
 * @returns {Promise<Object>}
 */
export async function saveOfficetelPurchaseCost(purchaseId, costData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_purchase_costs')
    .insert({
      user_id: user.id,
      purchase_id: purchaseId,
      ...costData,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 매물 기타 비용 수정
 * @param {string} costId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateOfficetelPurchaseCost(costId, updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_purchase_costs')
    .update(updates)
    .eq('id', costId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 매물 기타 비용 삭제
 * @param {string} costId
 * @returns {Promise<void>}
 */
export async function deleteOfficetelPurchaseCost(costId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('officetel_purchase_costs')
    .delete()
    .eq('id', costId)
    .eq('user_id', user.id)

  if (error) throw error
}
