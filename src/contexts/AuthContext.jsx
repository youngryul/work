import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase.js'
import { onAuthStateChange, signIn, signUp, signOut } from '../services/authService.js'
import { getUserRole } from '../services/userRoleService.js'
import {
  syncAuthUserId,
  getUserFromPersistedSession,
  refreshAuthSessionInBackground,
} from '../utils/authHelper.js'

const AUTH_LOADING_TIMEOUT_MS = 3000

const AuthContext = createContext(null)

/**
 * onAuthStateChange 콜백 안에서 supabase.auth 호출 시 데드락이 날 수 있어
 * 부가 작업은 마이크로태스크로 분리합니다.
 * @param {Function} fn
 */
function runAfterAuthCallback(fn) {
  queueMicrotask(() => {
    fn().catch(() => {})
  })
}

/**
 * 인증 컨텍스트 프로바이더
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('regular')
  const [adsEnabled, setAdsEnabled] = useState(true)

  const applyAuthUser = useCallback((u) => {
    syncAuthUserId(u?.id ?? null)
    setUser(u ?? null)
  }, [])

  const fetchRole = useCallback(async (u) => {
    if (!u?.id) {
      setUserRole('regular')
      return
    }
    const role = await getUserRole(u.id)
    setUserRole(role)
  }, [])

  const fetchAdPreference = useCallback(async (u) => {
    if (!u?.id) {
      setAdsEnabled(true)
      return
    }
    try {
      const { data, error } = await supabase
        .from('user_ad_settings')
        .select('ads_enabled')
        .eq('user_id', u.id)
        .maybeSingle()

      if (error) {
        setAdsEnabled(true)
        return
      }
      setAdsEnabled(data ? Boolean(data.ads_enabled) : true)
    } catch {
      setAdsEnabled(true)
    }
  }, [])

  const runUserSideEffects = useCallback(
    (u) => {
      runAfterAuthCallback(async () => {
        await fetchRole(u)
        await fetchAdPreference(u)
      })
    },
    [fetchAdPreference, fetchRole],
  )

  const refreshAdsPreference = useCallback(async () => {
    await fetchAdPreference(user)
  }, [user, fetchAdPreference])

  useEffect(() => {
    let mounted = true

    const finishLoading = () => {
      if (mounted) setLoading(false)
    }

    // 1) localStorage에서 즉시 복원 → 무한 로딩 방지
    const persistedUser = getUserFromPersistedSession()
    if (persistedUser) {
      applyAuthUser(persistedUser)
      finishLoading()
      runUserSideEffects(persistedUser)
    }

    // 2) 최대 대기 시간 후에는 반드시 로딩 종료
    const loadingTimeout = setTimeout(finishLoading, AUTH_LOADING_TIMEOUT_MS)

    // 3) 단일 auth 리스너 (콜백 내부에서 await / getSession 호출 금지)
    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      if (!mounted) return
      const u = session?.user ?? null
      applyAuthUser(u)
      finishLoading()
      runUserSideEffects(u)
    })

    return () => {
      mounted = false
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, [applyAuthUser, runUserSideEffects])

  // 탭 복귀 시 세션 갱신 (auth 콜백 밖에서 실행 → 데드락 없음)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      refreshAuthSessionInBackground()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const value = {
    user,
    loading,
    userRole,
    adsEnabled,
    refreshAdsPreference,
    isAdmin: userRole === 'admin',
    isSuperuser: userRole === 'superuser',
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * 인증 컨텍스트 훅
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
