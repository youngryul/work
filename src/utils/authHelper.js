import { supabase } from '../config/supabase.js'

const AUTH_STORAGE_KEY = 'sb-auth-token'
const USER_ID_CACHE_TTL_MS = 5 * 60 * 1000
const GET_USER_TIMEOUT_MS = 12000

/** AuthContext / onAuthStateChange 와 동기화된 사용자 ID */
let authSyncedUserId = null
let cachedUserId = null
let cachedAtMs = 0
let inFlightUserIdPromise = null
let authListenerInitialized = false

/**
 * AuthContext 등에서 로그인 사용자 ID를 동기화합니다.
 * @param {string|null} userId
 */
export function syncAuthUserId(userId) {
  authSyncedUserId = userId || null
  if (userId) {
    cachedUserId = userId
    cachedAtMs = Date.now()
  } else {
    cachedUserId = null
    cachedAtMs = 0
  }
}

/**
 * localStorage에 저장된 Supabase 세션에서 user id를 읽습니다. (네트워크 없음)
 * @returns {string|null}
 */
function getUserIdFromPersistedSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data?.user?.id ?? data?.currentSession?.user?.id ?? null
  } catch {
    return null
  }
}

/**
 * Supabase auth 상태 변경 시 캐시를 최신화합니다.
 */
function ensureAuthListener() {
  if (authListenerInitialized || typeof window === 'undefined') return
  authListenerInitialized = true

  supabase.auth.onAuthStateChange((_event, session) => {
    syncAuthUserId(session?.user?.id ?? null)
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    supabase.auth
      .getSession()
      .then(({ data }) => syncAuthUserId(data?.session?.user?.id ?? null))
      .catch(() => {})
  })
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {string} label
 * @param {number} timeoutMs
 */
async function withTimeout(promise, label, timeoutMs) {
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Auth timeout: ${label}`)),
      timeoutMs,
    )
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Supabase API로 user id 조회 (getSession 우선, 실패 시 getUser)
 * @returns {Promise<string|null>}
 */
async function resolveUserIdFromSupabase() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (!error && data?.session?.user?.id) {
      return data.session.user.id
    }
  } catch {
    // getSession 실패 시 getUser로 폴백
  }

  try {
    const { data, error } = await withTimeout(
      supabase.auth.getUser(),
      'getUser(getCurrentUserId)',
      GET_USER_TIMEOUT_MS,
    )
    if (!error && data?.user?.id) {
      return data.user.id
    }
  } catch {
    // 타임아웃·네트워크 오류 시 null
  }

  return null
}

/**
 * 현재 로그인한 사용자의 ID를 가져옵니다.
 * @returns {Promise<string|null>}
 */
export async function getCurrentUserId() {
  ensureAuthListener()

  if (authSyncedUserId) {
    return authSyncedUserId
  }

  const now = Date.now()
  if (cachedUserId && now - cachedAtMs < USER_ID_CACHE_TTL_MS) {
    return cachedUserId
  }

  const persistedUserId = getUserIdFromPersistedSession()
  if (persistedUserId) {
    cachedUserId = persistedUserId
    cachedAtMs = now
    return persistedUserId
  }

  if (inFlightUserIdPromise) {
    return inFlightUserIdPromise
  }

  inFlightUserIdPromise = (async () => {
    try {
      const userId = await resolveUserIdFromSupabase()
      if (userId) {
        cachedUserId = userId
        cachedAtMs = Date.now()
        if (!authSyncedUserId) {
          authSyncedUserId = userId
        }
        return userId
      }
      return null
    } catch (error) {
      if (
        error.name === 'AuthSessionMissingError' ||
        error.message?.includes('Auth session missing')
      ) {
        return null
      }
      const fallback = getUserIdFromPersistedSession()
      if (fallback) {
        cachedUserId = fallback
        cachedAtMs = Date.now()
        return fallback
      }
      return null
    } finally {
      inFlightUserIdPromise = null
    }
  })()

  return inFlightUserIdPromise
}

/**
 * 현재 로그인한 사용자가 있는지 확인합니다.
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const userId = await getCurrentUserId()
  return userId !== null
}
