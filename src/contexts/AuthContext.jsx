import { createContext, useContext, useState, useEffect } from 'react'
import { getCurrentUser, onAuthStateChange, signIn, signUp, signOut } from '../services/authService.js'
import { getUserRole } from '../services/userRoleService.js'

const AuthContext = createContext(null)

/**
 * 인증 컨텍스트 프로바이더
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('regular') // 'admin' | 'superuser' | 'regular'

  const fetchRole = async (u) => {
    if (!u) { setUserRole('regular'); return }
    const role = await getUserRole(u.id)
    setUserRole(role)
  }

  useEffect(() => {
    // 초기 사용자 로드
    getCurrentUser()
      .then((u) => { setUser(u); fetchRole(u) })
      .catch(() => { setUser(null); setUserRole('regular') })
      .finally(() => setLoading(false))

    // 인증 상태 변경 감지
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      setUser(u)
      fetchRole(u)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = {
    user,
    loading,
    userRole,
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

