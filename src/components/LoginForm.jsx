import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

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
      }
    } catch (err) {
      setError(err.message || '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
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
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base font-sans"
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
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base font-sans"
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
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-sans"
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
            className="text-sm text-indigo-600 hover:text-indigo-500 font-medium font-sans transition-colors duration-200"
          >
            {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
          </button>
        </div>
      </div>
    </div>
  )
}

