import { supabase } from '../config/supabase.js'

const AUTH_CALL_TIMEOUT_MS = 4000
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
 * getSession/getUser를 병렬 조회하여 빠르게 user id를 얻습니다.
 * @returns {Promise<string|null>}
 */
async function resolveCurrentUserIdFast() {
  const sessionUserIdPromise = supabase.auth
    .getSession()
    .then(({ data, error }) => (error ? null : data?.session?.user?.id ?? null))
    .catch(() => null)

  const directUserIdPromise = supabase.auth
    .getUser()
    .then(({ data, error }) => (error ? null : data?.user?.id ?? null))
    .catch(() => null)

  const winner = await withTimeout(
    Promise.any([sessionUserIdPromise, directUserIdPromise]),
    'resolveCurrentUserIdFast:parallelAuthLookup'
  )

  return winner ?? null
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
    const userId = await resolveCurrentUserIdFast()
    if (userId) {
      cachedUserId = userId
      cachedAtMs = Date.now()
      return userId
    }

    return null
  } catch (error) {
    // AuthSessionMissingError는 조용히 처리 (세션이 아직 준비되지 않은 경우)
    if (error.name === 'AuthSessionMissingError' || error.message?.includes('Auth session missing')) {
      return null
    }
    if (error.message?.includes('Auth timeout:') || error.name === 'AggregateError') {
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

