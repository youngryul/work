import { supabase } from '../config/supabase.js'

const AUTH_CALL_TIMEOUT_MS = 8000
const USER_ID_CACHE_TTL_MS = 1500
let cachedUserId = null
let cachedAtMs = 0
let inFlightUserIdPromise = null

/**
 * Supabase auth 호출 타임아웃 방어
 * @template T
 * @param {Promise<T>} promise
 * @param {string} label
 * @returns {Promise<T>}
 */
async function withTimeout(promise, label) {
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Auth timeout: ${label}`)), AUTH_CALL_TIMEOUT_MS)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * 현재 로그인한 사용자의 ID를 가져옵니다.
 * 배포 환경에서 세션이 로드되기 전에 호출될 수 있으므로 재시도 로직 포함
 * @returns {Promise<string|null>} 사용자 ID 또는 null
 */
export async function getCurrentUserId() {
  const now = Date.now()
  if (cachedUserId && now - cachedAtMs < USER_ID_CACHE_TTL_MS) {
    return cachedUserId
  }
  if (inFlightUserIdPromise) {
    return inFlightUserIdPromise
  }

  inFlightUserIdPromise = (async () => {
  try {
    // 세션 우선 조회(로컬) 후 필요 시 getUser 호출로 보강
    const { data: { session }, error: sessionError } = await withTimeout(
      supabase.auth.getSession(),
      'getSession(getCurrentUserId)'
    )

    if (!sessionError && session?.user?.id) {
      cachedUserId = session.user.id
      cachedAtMs = Date.now()
      return session.user.id
    }

    const { data: { user }, error: userError } = await withTimeout(
      supabase.auth.getUser(),
      'getUser(getCurrentUserId)'
    )

    if (!userError && user?.id) {
      cachedUserId = user.id
      cachedAtMs = Date.now()
      return user.id
    }

    return null
  } catch (error) {
    // AuthSessionMissingError는 조용히 처리 (세션이 아직 준비되지 않은 경우)
    if (error.name === 'AuthSessionMissingError' || error.message?.includes('Auth session missing')) {
      return null
    }
    if (error.message?.includes('Auth timeout:')) {
      console.warn('인증 사용자 ID 로딩 타임아웃:', error.message)
      return null
    }
    // 다른 에러도 조용히 처리 (배포 환경에서 발생할 수 있음)
    return null
  } finally {
    inFlightUserIdPromise = null
  }
  })()

  return inFlightUserIdPromise
}

/**
 * 현재 로그인한 사용자가 있는지 확인합니다.
 * @returns {Promise<boolean>} 로그인 여부
 */
export async function isAuthenticated() {
  const userId = await getCurrentUserId()
  return userId !== null
}

