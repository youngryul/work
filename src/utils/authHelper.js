import { supabase } from '../config/supabase.js'

const AUTH_STORAGE_KEY = 'sb-auth-token'

/** AuthContext에서 동기화한 사용자 ID (API 호출의 1차 소스) */
let authSyncedUserId = null

/**
 * AuthContext에서 로그인 상태를 동기화합니다.
 * @param {string|null} userId
 */
export function syncAuthUserId(userId) {
  authSyncedUserId = userId || null
}

/**
 * localStorage에 저장된 Supabase 세션 JSON을 읽습니다.
 * @returns {object|null}
 */
function readPersistedSessionData() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * localStorage 세션에서 user id를 동기적으로 읽습니다.
 * @returns {string|null}
 */
export function getUserIdFromPersistedSession() {
  const data = readPersistedSessionData()
  return data?.user?.id ?? data?.currentSession?.user?.id ?? null
}

/**
 * localStorage 세션에서 User 객체를 동기적으로 읽습니다.
 * @returns {import('@supabase/supabase-js').User|null}
 */
export function getUserFromPersistedSession() {
  const data = readPersistedSessionData()
  return data?.user ?? data?.currentSession?.user ?? null
}

/**
 * 동기적으로 현재 사용자 ID를 반환합니다. (네트워크 없음)
 * @returns {string|null}
 */
export function getCurrentUserIdSync() {
  if (authSyncedUserId) return authSyncedUserId
  return getUserIdFromPersistedSession()
}

/**
 * 현재 로그인한 사용자 ID를 가져옵니다.
 * AuthContext 동기화 → localStorage 순으로만 조회해 데드락을 방지합니다.
 * @returns {Promise<string|null>}
 */
export async function getCurrentUserId() {
  const syncId = getCurrentUserIdSync()
  if (syncId) return syncId

  // AuthProvider 마운트 직후 등 극히 짧은 공백만 대기
  await new Promise((resolve) => setTimeout(resolve, 50))
  return getCurrentUserIdSync()
}

/**
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  return (await getCurrentUserId()) !== null
}

/**
 * 백그라운드에서 세션을 갱신합니다. (onAuthStateChange 콜백 밖에서만 호출)
 */
export async function refreshAuthSessionInBackground() {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (!error && data?.session?.user?.id) {
      syncAuthUserId(data.session.user.id)
    }
  } catch {
    // 무시
  }
}
