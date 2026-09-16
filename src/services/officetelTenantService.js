import { supabase } from '../config/supabase.js'

/**
 * 매물의 임차인 목록 조회
 * @param {string} purchaseId
 * @returns {Promise<Array>}
 */
export async function getOfficetelTenants(purchaseId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_tenants')
    .select('*')
    .eq('user_id', user.id)
    .eq('purchase_id', purchaseId)
    .order('contract_start_date', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * 임차인 추가
 * @param {string} purchaseId
 * @param {Object} tenantData - { tenant_name, contract_start_date, contract_end_date, deposit, monthly_rent, memo }
 * @returns {Promise<Object>}
 */
export async function saveOfficetelTenant(purchaseId, tenantData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_tenants')
    .insert({
      user_id: user.id,
      purchase_id: purchaseId,
      ...tenantData,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 임차인 정보 수정
 * @param {string} tenantId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateOfficetelTenant(tenantId, updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_tenants')
    .update(updates)
    .eq('id', tenantId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 임차인 삭제 (월세 수령 기록도 함께 삭제됨)
 * @param {string} tenantId
 * @returns {Promise<void>}
 */
export async function deleteOfficetelTenant(tenantId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('officetel_tenants')
    .delete()
    .eq('id', tenantId)
    .eq('user_id', user.id)

  if (error) throw error
}

/**
 * 여러 임차인의 월별 월세 수령 체크 내역을 한번에 조회
 * @param {string[]} tenantIds
 * @returns {Promise<Record<string, string[]>>} tenantId -> 수령 완료된 'YYYY-MM' 배열
 */
export async function getOfficetelTenantRentPaymentsMap(tenantIds) {
  if (!tenantIds || tenantIds.length === 0) return {}

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_tenant_rent_payments')
    .select('tenant_id, pay_month')
    .eq('user_id', user.id)
    .in('tenant_id', tenantIds)

  if (error) throw error

  return (data || []).reduce((map, row) => {
    if (!map[row.tenant_id]) map[row.tenant_id] = []
    map[row.tenant_id].push(row.pay_month)
    return map
  }, {})
}

/**
 * 특정 달 월세 수령 체크 (없으면 추가)
 * @param {string} tenantId
 * @param {string} payMonth - 'YYYY-MM'
 * @returns {Promise<Object>}
 */
export async function markOfficetelTenantRentPaid(tenantId, payMonth) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_tenant_rent_payments')
    .upsert(
      { user_id: user.id, tenant_id: tenantId, pay_month: payMonth },
      { onConflict: 'tenant_id,pay_month' },
    )
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 특정 달 월세 수령 체크 해제 (삭제)
 * @param {string} tenantId
 * @param {string} payMonth - 'YYYY-MM'
 * @returns {Promise<void>}
 */
export async function unmarkOfficetelTenantRentPaid(tenantId, payMonth) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('officetel_tenant_rent_payments')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('pay_month', payMonth)
    .eq('user_id', user.id)

  if (error) throw error
}
