import { supabase } from '../config/supabase.js'

/**
 * 현재 로그인한 사용자의 ID를 가져옵니다.
 * @returns {Promise<string|null>} 사용자 ID 또는 null
 */
export async function getCurrentUserId() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      console.error('사용자 정보 조회 오류:', error)
      return null
    }
    return user?.id || null
  } catch (error) {
    console.error('사용자 ID 가져오기 오류:', error)
    return null
  }
}

/**
 * 현재 로그인한 사용자가 있는지 확인합니다.
 * @returns {Promise<boolean>} 로그인 여부
 */
export async function isAuthenticated() {
  const userId = await getCurrentUserId()
  return userId !== null
}

