import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../config/supabase.js'

/**
 * 로그인/회원가입 폼 컴포넌트
 */
export default function LoginForm() {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const isMacAppRedirect = new URLSearchParams(window.location.search).get('redirectTo') === 'potatobuddy'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (isSignUp) {
        await signUp(email, password)
        setMessage('회원가입이 완료되었습니다. 이메일을 확인하여 계정을 활성화하세요.')
      } else {
        await signIn(email, password)

        // 맥앱에서 열린 경우 토큰을 URL 스킴으로 전달
        if (isMacAppRedirect) {
          const { data } = await supabase.auth.getSession()
          const token = data?.session?.access_token
          const userId = data?.session?.user?.id
          if (token && userId) {
            window.location.href = `potatobuddy://auth?access_token=${encodeURIComponent(token)}&user_id=${encodeURIComponent(userId)}`
          }
        }
      }
    } catch (err) {
      setError(err.message || '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-xl border border-gray-200">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 font-sans">
            {isSignUp ? '회원가입' : '로그인'}
          </h2>
          <p className="mt-2 text-sm text-gray-600 font-sans">
            {isSignUp ? '새 계정을 만들어 시작하세요' : '계정에 로그인하세요'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 font-sans mb-2">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base font-sans"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 font-sans mb-2">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="최소 6자 이상"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base font-sans"
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-sans">
              {error}
            </div>
          )}
          
          {message && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-sans">
              {message}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-sans"
          >
            {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
          </button>
        </form>
        
        <div className="text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
              setMessage(null)
            }}
            className="text-sm text-green-700 hover:text-green-500 font-medium font-sans transition-colors duration-200"
          >
            {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
          </button>
        </div>
      </div>
    </div>
  )
}

