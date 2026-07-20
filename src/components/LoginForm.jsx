import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { supabase } from '../config/supabase.js'

/**
 * 로그인/회원가입 폼 (이메일 + Google)
 */
export default function LoginForm() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const isMacAppRedirect =
    new URLSearchParams(window.location.search).get('redirectTo') === 'potatobuddy'

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

  const handleGoogleLogin = async () => {
    setError(null)
    setMessage(null)
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      // 성공 시 Google로 리다이렉트되므로 여기 loading은 유지되어도 무방
    } catch (err) {
      setError(err.message || 'Google 로그인에 실패했습니다.')
      setGoogleLoading(false)
    }
  }

  const busy = loading || googleLoading

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

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border-2 border-gray-200 bg-white text-gray-800 text-base font-medium font-sans shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <GoogleIcon />
          {googleLoading ? 'Google로 이동 중...' : 'Google로 계속하기'}
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-3 text-gray-500 font-sans">또는</span>
          </div>
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
            disabled={busy}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-sans"
          >
            {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
