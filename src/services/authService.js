import { supabase } from '../config/supabase.js'

const AUTH_CALL_TIMEOUT_MS = 4000

/**
 * Supabase auth 호출이 영원히 pending 되는 상황을 방지합니다.
 * (환경 변수 미설정/네트워크 문제 등에서 로딩이 안 풀리는 케이스 방어)
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
 * getSession/getUser를 병렬 조회하여 더 빠르게 인증 사용자를 찾습니다.
 * @param {string} label
 * @returns {Promise<import('@supabase/supabase-js').User|null>}
 */
async function resolveAuthUserFast(label) {
  const sessionUserPromise = supabase.auth
    .getSession()
    .then(({ data, error }) => (error ? null : data?.session?.user ?? null))
    .catch(() => null)

  const directUserPromise = supabase.auth
    .getUser()
    .then(({ data, error }) => (error ? null : data?.user ?? null))
    .catch(() => null)

  const winner = await withTimeout(
    Promise.any([sessionUserPromise, directUserPromise]),
    `${label}:parallelAuthLookup`
  )

  return winner ?? null
}

/**
 * 기존 데이터를 현재 사용자에게 할당
 */
export async function migrateExistingData() {
  try {
    const { data: { user } } = await withTimeout(supabase.auth.getUser(), 'getUser(migrateExistingData)')
    
    if (!user) {
      throw new Error('로그인이 필요합니다.')
    }

    // 기존 데이터가 있는지 확인
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id')
      .is('user_id', null)
      .limit(1)

    if (existingTasks && existingTasks.length > 0) {
      // 기존 데이터를 현재 사용자에게 할당
      const { error } = await supabase.rpc('assign_existing_data_to_user', {
        target_user_id: user.id
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
    // 프로덕션 URL 또는 환경 변수에서 가져오기
    const redirectTo = import.meta.env.VITE_APP_URL || 'https://work-sable-one.vercel.app/'
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    })
    
    if (error) throw error
    
    // 첫 번째 사용자인 경우 기존 데이터 마이그레이션
    if (data.user) {
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
    
    // 첫 로그인 시 기존 데이터 마이그레이션 시도
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
  } catch (error) {
    console.error('로그아웃 오류:', error)
    throw error
  }
}

/**
 * 현재 사용자 정보 가져오기
 * 배포 환경에서 세션이 로드되기 전에 호출될 수 있으므로 재시도 로직 포함
 */
export async function getCurrentUser() {
  try {
    return await resolveAuthUserFast('getCurrentUser')
  } catch (error) {
    // AuthSessionMissingError는 조용히 처리
    if (error.name === 'AuthSessionMissingError' || error.message?.includes('Auth session missing')) {
      return null
    }
    if (error.message?.includes('Auth timeout:') || error.name === 'AggregateError') {
      return null
    }
    // 다른 에러도 조용히 처리 (배포 환경에서 발생할 수 있음)
    return null
  }
}

/**
 * 인증 상태 변경 감지
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}

