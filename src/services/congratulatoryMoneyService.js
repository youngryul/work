import { supabase } from '../config/supabase.js'

/**
 * 경조사 기록 저장
 * @param {Object} recordData - 기록 데이터
 * @param {string} recordData.type - '축의금' 또는 '부조금'
 * @param {number} recordData.amount - 금액
 * @param {string} recordData.recipient_name - 받는 사람 이름
 * @param {string} recordData.relationship - 관계
 * @param {string} recordData.phone_number - 전화번호
 * @param {string} recordData.event_date - 경조사 날짜 (YYYY-MM-DD)
 * @returns {Promise<Object>} 저장된 기록
 */
export async function saveCongratulatoryMoneyRecord(recordData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('congratulatory_money_records')
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
 * 경조사 기록 조회
 * @param {Object} options - 조회 옵션
 * @param {string} options.startDate - 시작 날짜 (YYYY-MM-DD)
 * @param {string} options.endDate - 종료 날짜 (YYYY-MM-DD)
 * @param {string} options.type - '축의금' 또는 '부조금'
 * @returns {Promise<Array>} 기록 목록
 */
export async function getCongratulatoryMoneyRecords(options = {}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  let query = supabase
    .from('congratulatory_money_records')
    .select('*')
    .eq('user_id', user.id)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (options.startDate) {
    query = query.gte('event_date', options.startDate)
  }
  if (options.endDate) {
    query = query.lte('event_date', options.endDate)
  }
  if (options.type) {
    query = query.eq('type', options.type)
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

/**
 * 경조사 기록 수정
 * @param {string} recordId - 기록 ID
 * @param {Object} updates - 수정할 데이터
 * @returns {Promise<Object>} 수정된 기록
 */
export async function updateCongratulatoryMoneyRecord(recordId, updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('congratulatory_money_records')
    .update(updates)
    .eq('id', recordId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 경조사 기록 삭제
 * @param {string} recordId - 기록 ID
 * @returns {Promise<void>}
 */
export async function deleteCongratulatoryMoneyRecord(recordId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('congratulatory_money_records')
    .delete()
    .eq('id', recordId)
    .eq('user_id', user.id)

  if (error) throw error
}

/**
 * 청첩장 인원 저장
 * @param {Object} recipientData - 인원 데이터
 * @param {string} recipientData.recipient_name - 받는 사람 이름
 * @param {string} recipientData.relationship - 관계
 * @returns {Promise<Object>} 저장된 인원
 */
export async function saveWeddingInvitationRecipient(recipientData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('wedding_invitation_recipients')
    .insert({
      user_id: user.id,
      ...recipientData,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 청첩장 인원 조회
 * @param {Object} options - 조회 옵션 (현재 사용하지 않음)
 * @returns {Promise<Array>} 인원 목록
 */
export async function getWeddingInvitationRecipients(options = {}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('wedding_invitation_recipients')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * 청첩장 인원 수정
 * @param {string} recipientId - 인원 ID
 * @param {Object} updates - 수정할 데이터
 * @returns {Promise<Object>} 수정된 인원
 */
export async function updateWeddingInvitationRecipient(recipientId, updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('wedding_invitation_recipients')
    .update(updates)
    .eq('id', recipientId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 청첩장 인원 삭제
 * @param {string} recipientId - 인원 ID
 * @returns {Promise<void>}
 */
export async function deleteWeddingInvitationRecipient(recipientId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('wedding_invitation_recipients')
    .delete()
    .eq('id', recipientId)
    .eq('user_id', user.id)

  if (error) throw error
}

/**
 * 축의금 받는 인원 저장
 * @param {Object} recipientData - 인원 데이터
 * @param {string} recipientData.recipient_name - 받는 사람 이름
 * @param {string} recipientData.relationship - 관계
 * @param {number} recipientData.amount - 받은 금액
 * @returns {Promise<Object>} 저장된 인원
 */
export async function saveCongratulatoryMoneyRecipient(recipientData) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('congratulatory_money_recipients')
    .insert({
      user_id: user.id,
      ...recipientData,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 축의금 받는 인원 조회
 * @param {Object} options - 조회 옵션 (현재 사용하지 않음)
 * @returns {Promise<Array>} 인원 목록
 */
export async function getCongratulatoryMoneyRecipients(options = {}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('congratulatory_money_recipients')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * 축의금 받는 인원 수정
 * @param {string} recipientId - 인원 ID
 * @param {Object} updates - 수정할 데이터
 * @returns {Promise<Object>} 수정된 인원
 */
export async function updateCongratulatoryMoneyRecipient(recipientId, updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('congratulatory_money_recipients')
    .update(updates)
    .eq('id', recipientId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 축의금 받는 인원 삭제
 * @param {string} recipientId - 인원 ID
 * @returns {Promise<void>}
 */
export async function deleteCongratulatoryMoneyRecipient(recipientId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('congratulatory_money_recipients')
    .delete()
    .eq('id', recipientId)
    .eq('user_id', user.id)

  if (error) throw error
}
