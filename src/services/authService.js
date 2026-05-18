import { supabase } from '../config/supabase.js'
import { syncAuthUserId } from '../utils/authHelper.js'

const AUTH_STORAGE_KEY = 'sb-auth-token'
const GET_USER_TIMEOUT_MS = 12000

/**
 * localStorage 세션에서 사용자 정보를 읽습니다.
 * @returns {import('@supabase/supabase-js').User|null}
 */
function getUserFromPersistedSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return data?.user ?? data?.currentSession?.user ?? null
  } catch {
    return null
  }
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
 * getSession 우선, 필요 시 getUser로 인증 사용자를 조회합니다.
 * @param {string} label
 * @returns {Promise<import('@supabase/supabase-js').User|null>}
 */
async function resolveAuthUserFast(label) {
  const persistedUser = getUserFromPersistedSession()
  if (persistedUser) {
    return persistedUser
  }

  try {
    const { data, error } = await supabase.auth.getSession()
    if (!error && data?.session?.user) {
      return data.session.user
    }
  } catch {
    // getUser 폴백
  }

  try {
    const { data, error } = await withTimeout(
      supabase.auth.getUser(),
      `${label}:getUser`,
      GET_USER_TIMEOUT_MS,
    )
    if (!error && data?.user) {
      return data.user
    }
  } catch {
    return getUserFromPersistedSession()
  }

  return getUserFromPersistedSession()
}

/**
 * 기존 데이터를 현재 사용자에게 할당
 */
export async function migrateExistingData() {
  try {
    const user = await resolveAuthUserFast('migrateExistingData')

    if (!user) {
      throw new Error('로그인이 필요합니다.')
    }

    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id')
      .is('user_id', null)
      .limit(1)

    if (existingTasks && existingTasks.length > 0) {
      const { error } = await supabase.rpc('assign_existing_data_to_user', {
        target_user_id: user.id,
      })

      if (error) {
        console.error('데이터 마이그레이션 오류:', error)
        throw error
      }

      return { migrated: true }
    }

    return { migrated: false }
  } catch (error) {
    console.error('데이터 마이그레이션 실패:', error)
    throw error
  }
}

/**
 * 이메일/비밀번호로 회원가입
 */
export async function signUp(email, password) {
  try {
    const redirectTo = import.meta.env.VITE_APP_URL || 'https://work-sable-one.vercel.app/'

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    })

    if (error) throw error

    if (data.user) {
      syncAuthUserId(data.user.id)
      try {
        await migrateExistingData()
      } catch (migrationError) {
        console.warn('데이터 마이그레이션 실패:', migrationError)
      }
    }

    return data
  } catch (error) {
    console.error('회원가입 오류:', error)
    throw error
  }
}

/**
 * 이메일/비밀번호로 로그인
 */
export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    if (data.user) {
      syncAuthUserId(data.user.id)
    }

    try {
      await migrateExistingData()
    } catch (migrationError) {
      console.warn('데이터 마이그레이션 실패:', migrationError)
    }

    return data
  } catch (error) {
    console.error('로그인 오류:', error)
    throw error
  }
}

/**
 * 로그아웃
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    syncAuthUserId(null)
  } catch (error) {
    console.error('로그아웃 오류:', error)
    throw error
  }
}

/**
 * 현재 사용자 정보 가져오기
 */
export async function getCurrentUser() {
  try {
    const user = await resolveAuthUserFast('getCurrentUser')
    if (user) {
      syncAuthUserId(user.id)
    }
    return user
  } catch (error) {
    if (error.name === 'AuthSessionMissingError' || error.message?.includes('Auth session missing')) {
      return getUserFromPersistedSession()
    }
    if (error.message?.includes('Auth timeout:')) {
      return getUserFromPersistedSession()
    }
    return getUserFromPersistedSession()
  }
}

/**
 * 인증 상태 변경 감지
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}
