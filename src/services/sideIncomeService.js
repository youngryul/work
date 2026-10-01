import { supabase } from '../config/supabase.js'

const TABLE = 'side_incomes'

/**
 * 연도별 부수입 내역 조회 (날짜 내림차순)
 * @param {number} year - 조회할 연도
 * @returns {Promise<Array>} 내역 목록
 */
export async function getSideIncomesByYear(year) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', user.id)
    .gte('income_date', `${year}-01-01`)
    .lte('income_date', `${year}-12-31`)
    .order('income_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * 부수입 내역 저장
 * @param {{ income_date: string, title: string, amount: number }} income
 * @returns {Promise<Object>} 저장된 내역
 */
export async function saveSideIncome(income) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ user_id: user.id, ...income })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 부수입 내역 수정
 * @param {string} id - 내역 ID
 * @param {{ income_date?: string, title?: string, amount?: number }} updates
 * @returns {Promise<Object>} 수정된 내역
 */
export async function updateSideIncome(id, updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * 부수입 내역 삭제
 * @param {string} id - 내역 ID
 */
export async function deleteSideIncome(id) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
}
