import { supabase } from '../config/supabase.js'

const TABLE = 'feedbacks'

/**
 * @param {Object} row
 */
function normalizeFeedback(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    category: row.category,
    title: row.title,
    content: row.content,
    status: row.status,
    adminReply: row.admin_reply,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 피드백 제출
 * @param {{ category: string, title: string, content: string }} params
 */
export async function submitFeedback({ category, title, content }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: user.id,
      user_email: user.email || null,
      category,
      title: title.trim(),
      content: content.trim(),
    })
    .select('*')
    .single()

  if (error) throw error
  return normalizeFeedback(data)
}

/**
 * 내가 보낸 피드백 목록
 */
export async function getMyFeedbacks() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeFeedback)
}

/**
 * 관리자: 전체 피드백 목록 (RLS로 관리자만 전체 조회 가능)
 */
export async function getAllFeedbacks() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeFeedback)
}

/**
 * 관리자: 상태 변경 / 답변 저장
 * @param {string} id
 * @param {{ status?: string, adminReply?: string }} updates
 */
export async function updateFeedbackByAdmin(id, { status, adminReply }) {
  const payload = {}
  if (status !== undefined) payload.status = status
  if (adminReply !== undefined) payload.admin_reply = adminReply.trim() || null

  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return normalizeFeedback(data)
}

/**
 * 관리자: 피드백 삭제
 * @param {string} id
 */
export async function deleteFeedbackByAdmin(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}
