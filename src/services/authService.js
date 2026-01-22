import { supabase } from '../config/supabase.js'

/**
 * 기존 데이터를 현재 사용자에게 할당
 */
export async function migrateExistingData() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
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
    // 먼저 getUser() 시도
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (!userError && user) {
      return user
    }
    
    // getUser() 실패 시 세션 확인 (재시도)
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (!sessionError && session?.user) {
      return session.user
    }
    
    // 둘 다 실패하면 null 반환 (에러를 던지지 않음)
    return null
  } catch (error) {
    // AuthSessionMissingError는 조용히 처리
    if (error.name === 'AuthSessionMissingError' || error.message?.includes('Auth session missing')) {
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

