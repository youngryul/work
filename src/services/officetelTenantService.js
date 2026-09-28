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
 * 임차인 삭제 (월세 수령 기록 + 사업자등록증 파일도 함께 삭제됨)
 * @param {string} tenantId
 * @param {string|null} businessLicensePath - 첨부된 사업자등록증 경로 (있으면 Storage에서도 삭제)
 * @returns {Promise<void>}
 */
export async function deleteOfficetelTenant(tenantId, businessLicensePath = null) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('officetel_tenants')
    .delete()
    .eq('id', tenantId)
    .eq('user_id', user.id)

  if (error) throw error

  if (businessLicensePath) {
    await removeOfficetelDocument(businessLicensePath)
  }
}

// 사업자등록증 등 임차인 문서용 비공개 버킷
const DOCUMENT_BUCKET = 'officetel-documents'
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

/**
 * 임차인 사업자등록증 업로드
 * 기존 파일이 있으면 교체 후 이전 파일 삭제
 * @param {Object} tenant - 임차인 행 (id, business_license_path 사용)
 * @param {File} file - 이미지 또는 PDF
 * @returns {Promise<Object>} 업데이트된 임차인
 */
export async function uploadOfficetelTenantBusinessLicense(tenant, file) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    throw new Error('이미지(JPG, PNG, WEBP, HEIC) 또는 PDF 파일만 첨부할 수 있습니다.')
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new Error('파일 크기는 10MB 이하여야 합니다.')
  }

  // Storage 정책상 첫 폴더는 반드시 본인 user_id
  const fileExt = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin'
  const filePath = `${user.id}/tenants/${tenant.id}/business-license-${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(filePath, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    const message = uploadError.message || ''
    if (message.includes('Bucket not found') || message.includes('not found')) {
      throw new Error('Storage 버킷이 없습니다. supabase-officetel-tenant-business-license.sql을 실행해주세요.')
    }
    throw new Error(`파일 업로드 실패: ${message || '알 수 없는 오류'}`)
  }

  try {
    const updated = await updateOfficetelTenant(tenant.id, {
      business_license_path: filePath,
      business_license_name: file.name,
    })
    if (tenant.business_license_path) {
      await removeOfficetelDocument(tenant.business_license_path)
    }
    return updated
  } catch (error) {
    // DB 반영 실패 시 방금 올린 파일 정리
    await removeOfficetelDocument(filePath)
    throw error
  }
}

/**
 * 임차인 사업자등록증 첨부 삭제
 * @param {Object} tenant - 임차인 행 (id, business_license_path 사용)
 * @returns {Promise<Object>} 업데이트된 임차인
 */
export async function deleteOfficetelTenantBusinessLicense(tenant) {
  const updated = await updateOfficetelTenant(tenant.id, {
    business_license_path: null,
    business_license_name: null,
  })
  if (tenant.business_license_path) {
    await removeOfficetelDocument(tenant.business_license_path)
  }
  return updated
}

/**
 * 사업자등록증 열람용 임시 URL 생성 (비공개 버킷이므로 서명 URL 사용)
 * @param {string} path - Storage 경로
 * @param {number} expiresIn - 유효 시간(초), 기본 5분
 * @returns {Promise<string>}
 */
export async function getOfficetelDocumentUrl(path, expiresIn = 300) {
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error) throw error
  return data.signedUrl
}

/**
 * Storage 파일 삭제 (실패해도 본 작업은 유지되도록 로그만 남김)
 * @param {string} path
 */
async function removeOfficetelDocument(path) {
  const { error } = await supabase.storage.from(DOCUMENT_BUCKET).remove([path])
  if (error) {
    console.warn('임차인 문서 파일 삭제 실패:', error)
  }
}

/**
 * 여러 임차인의 보증금 수령 내역을 한번에 조회
 * @param {string[]} tenantIds
 * @returns {Promise<Record<string, Array>>} tenantId -> 수령 내역 배열
 */
export async function getOfficetelTenantDepositSharesMap(tenantIds) {
  if (!tenantIds || tenantIds.length === 0) return {}

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_tenant_deposit_shares')
    .select('*')
    .eq('user_id', user.id)
    .in('tenant_id', tenantIds)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data || []).reduce((map, row) => {
    if (!map[row.tenant_id]) map[row.tenant_id] = []
    map[row.tenant_id].push(row)
    return map
  }, {})
}

/**
 * 보증금 수령 내역 추가
 * @param {string} tenantId
 * @param {Object} shareData - { holder_name, amount, memo }
 * @returns {Promise<Object>}
 */
export async function saveOfficetelTenantDepositShare(tenantId, shareData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_tenant_deposit_shares')
    .insert({
      user_id: user.id,
      tenant_id: tenantId,
      ...shareData,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 보증금 수령 내역 수정
 * @param {string} shareId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateOfficetelTenantDepositShare(shareId, updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('officetel_tenant_deposit_shares')
    .update(updates)
    .eq('id', shareId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 보증금 수령 내역 삭제
 * @param {string} shareId
 * @returns {Promise<void>}
 */
export async function deleteOfficetelTenantDepositShare(shareId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('officetel_tenant_deposit_shares')
    .delete()
    .eq('id', shareId)
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
