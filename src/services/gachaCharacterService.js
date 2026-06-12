import { supabase } from '../config/supabase.js'

import { getCurrentUserId } from '../utils/authHelper.js'

import { isAdmin } from './adminService.js'



/**

 * @param {Object} row

 */

function normalizeCharacter(row) {

  return {

    id: row.id,

    name: row.name,

    grade: row.grade,

    imageUrl: row.image_url,

    dropWeight: row.drop_weight,

    isActive: row.is_active,

    createdAt: row.created_at,

    updatedAt: row.updated_at,

  }

}



/**

 * 활성 포실이 목록 (뽑기 풀)

 * @returns {Promise<Array>}

 */

export async function getActiveGachaCharacters() {

  const { data, error } = await supabase

    .from('gacha_characters')

    .select('*')

    .eq('is_active', true)

    .order('grade', { ascending: true })

    .order('name', { ascending: true })



  if (error) throw error

  return (data || []).map(normalizeCharacter)

}



/**

 * 관리자: 전체 포실이 목록

 * @returns {Promise<Array>}

 */

export async function getAllGachaCharacters() {

  const userId = await getCurrentUserId()

  if (!userId) throw new Error('로그인이 필요합니다.')



  const admin = await isAdmin(userId)

  if (!admin) throw new Error('관리자 권한이 필요합니다.')



  const { data, error } = await supabase

    .from('gacha_characters')

    .select('*')

    .order('created_at', { ascending: false })



  if (error) throw error

  return (data || []).map(normalizeCharacter)

}



/**

 * 관리자: 포실이 등록

 * @param {{ name: string, grade: string, imageUrl: string, dropWeight?: number, isActive?: boolean }} params

 */

export async function createGachaCharacter(params) {

  const userId = await getCurrentUserId()

  if (!userId) throw new Error('로그인이 필요합니다.')



  const admin = await isAdmin(userId)

  if (!admin) throw new Error('관리자 권한이 필요합니다.')



  const name = (params.name || '').trim()

  if (!name) throw new Error('이름을 입력해주세요.')

  if (!params.imageUrl) throw new Error('이미지를 업로드해주세요.')



  const { data, error } = await supabase

    .from('gacha_characters')

    .insert([{

      name,

      grade: params.grade,

      image_url: params.imageUrl,

      drop_weight: params.dropWeight ?? 100,

      is_active: params.isActive !== false,

    }])

    .select('*')

    .single()



  if (error) throw error

  return normalizeCharacter(data)

}



/**

 * 관리자: 포실이 수정

 * @param {string} id

 * @param {{ name?: string, grade?: string, imageUrl?: string, dropWeight?: number, isActive?: boolean }} params

 */

export async function updateGachaCharacter(id, params) {

  const userId = await getCurrentUserId()

  if (!userId) throw new Error('로그인이 필요합니다.')



  const admin = await isAdmin(userId)

  if (!admin) throw new Error('관리자 권한이 필요합니다.')



  const updates = { updated_at: new Date().toISOString() }

  if (params.name !== undefined) updates.name = params.name.trim()

  if (params.grade !== undefined) updates.grade = params.grade

  if (params.imageUrl !== undefined) updates.image_url = params.imageUrl

  if (params.dropWeight !== undefined) updates.drop_weight = params.dropWeight

  if (params.isActive !== undefined) updates.is_active = params.isActive



  const { data, error } = await supabase

    .from('gacha_characters')

    .update(updates)

    .eq('id', id)

    .select('*')

    .single()



  if (error) throw error

  return normalizeCharacter(data)

}



/**

 * 관리자: 포실이 삭제

 * @param {string} id

 */

export async function deleteGachaCharacter(id) {

  const userId = await getCurrentUserId()

  if (!userId) throw new Error('로그인이 필요합니다.')



  const admin = await isAdmin(userId)

  if (!admin) throw new Error('관리자 권한이 필요합니다.')



  const { error } = await supabase.from('gacha_characters').delete().eq('id', id)

  if (error) throw error

}


