import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getCurrentUser, onAuthStateChange, signIn, signUp, signOut } from '../services/authService.js'
import { getUserRole } from '../services/userRoleService.js'
import { getAdsEnabledForCurrentUser } from '../services/adSettingsService.js'
import { syncAuthUserId } from '../utils/authHelper.js'

const AuthContext = createContext(null)

/**
 * 인증 컨텍스트 프로바이더
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('regular') // 'admin' | 'superuser' | 'regular'
  const [adsEnabled, setAdsEnabled] = useState(true)

  const applyAuthUser = useCallback((u) => {
    syncAuthUserId(u?.id ?? null)
    setUser(u ?? null)
  }, [])

  const fetchRole = useCallback(async (u) => {
    if (!u) { setUserRole('regular'); return }
    const role = await getUserRole(u.id)
    setUserRole(role)
  }, [])

  const fetchAdPreference = useCallback(async (u) => {
    if (!u) {
      setAdsEnabled(true)
      return
    }
    try {
      const enabled = await getAdsEnabledForCurrentUser()
      setAdsEnabled(enabled)
    } catch {
      setAdsEnabled(true)
    }
  }, [])

  const refreshAdsPreference = useCallback(async () => {
    await fetchAdPreference(user)
  }, [user, fetchAdPreference])

  useEffect(() => {
    // 초기 사용자 로드
    getCurrentUser()
      .then(async (u) => {
        applyAuthUser(u)
        await fetchRole(u)
        await fetchAdPreference(u)
      })
      .catch(() => {
        applyAuthUser(null)
        setUserRole('regular')
        setAdsEnabled(true)
      })
      .finally(() => setLoading(false))

    // 인증 상태 변경 감지
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null
      applyAuthUser(u)
      fetchRole(u)
      await fetchAdPreference(u)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [applyAuthUser, fetchAdPreference, fetchRole])

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

