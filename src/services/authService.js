import { supabase } from '../config/supabase.js'
import {
  syncAuthUserId,
  getUserFromPersistedSession,
  getCurrentUserIdSync,
} from '../utils/authHelper.js'

/**
 * 기존 데이터를 현재 사용자에게 할당
 */
export async function migrateExistingData() {
  try {
    const userId = getCurrentUserIdSync()
    if (!userId) {
      throw new Error('로그인이 필요합니다.')
    }

    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id')
      .is('user_id', null)
      .limit(1)

    if (existingTasks && existingTasks.length > 0) {
      const { error } = await supabase.rpc('assign_existing_data_to_user', {
        target_user_id: userId,
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
 * Google OAuth 로그인 (Supabase Auth)
 * 브라우저가 Google → Supabase → redirectTo 로 돌아옵니다.
 */
export async function signInWithGoogle() {
  try {
    const base = (
      import.meta.env.VITE_APP_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '') ||
      'https://work-sable-one.vercel.app'
    ).replace(/\/$/, '')

    const search =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams()
    const redirectTo =
      search.get('redirectTo') === 'potatobuddy'
        ? `${base}/?redirectTo=potatobuddy`
        : `${base}/`

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Google 로그인 오류:', error)
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
 * 현재 사용자 정보 (동기 복원 우선, 네트워크 호출 없음)
 */
export function getCurrentUser() {
  const persisted = getUserFromPersistedSession()
  if (persisted) {
    syncAuthUserId(persisted.id)
    return Promise.resolve(persisted)
  }
  return Promise.resolve(null)
}

/**
 * 인증 상태 변경 감지
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}
