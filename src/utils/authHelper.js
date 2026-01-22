import { supabase } from '../config/supabase.js'

/**
 * 현재 로그인한 사용자의 ID를 가져옵니다.
 * @returns {Promise<string|null>} 사용자 ID 또는 null
 */
export async function getCurrentUserId() {
  try {
    // 먼저 세션 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    // 세션이 없으면 null 반환 (에러 로그는 남기지 않음 - 정상적인 경우일 수 있음)
    if (sessionError || !session) {
      // 세션이 없을 때는 조용히 처리 (로그인하지 않은 상태일 수 있음)
      return null
    }
    
    // 세션이 있으면 사용자 ID 반환
    return session.user?.id || null
  } catch (error) {
    // AuthSessionMissingError는 조용히 처리 (세션이 아직 준비되지 않은 경우)
    if (error.name === 'AuthSessionMissingError' || error.message?.includes('Auth session missing')) {
      return null
    }
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

