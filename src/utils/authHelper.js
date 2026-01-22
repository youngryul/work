import { supabase } from '../config/supabase.js'

/**
 * 현재 로그인한 사용자의 ID를 가져옵니다.
 * 배포 환경에서 세션이 로드되기 전에 호출될 수 있으므로 재시도 로직 포함
 * @returns {Promise<string|null>} 사용자 ID 또는 null
 */
export async function getCurrentUserId() {
  try {
    // 먼저 getUser() 시도 (더 안정적)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (!userError && user) {
      return user.id
    }
    
    // getUser() 실패 시 세션 확인 (재시도)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (!sessionError && session?.user) {
      return session.user.id
    }
    
    // 둘 다 실패하면 null 반환
    return null
  } catch (error) {
    // AuthSessionMissingError는 조용히 처리 (세션이 아직 준비되지 않은 경우)
    if (error.name === 'AuthSessionMissingError' || error.message?.includes('Auth session missing')) {
      return null
    }
    // 다른 에러도 조용히 처리 (배포 환경에서 발생할 수 있음)
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

