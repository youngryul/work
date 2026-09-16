import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

/**
 * 비밀번호 재설정 링크로 진입했을 때 새 비밀번호를 설정하는 화면
 */
export default function ResetPasswordView() {
  const { updatePassword, clearPasswordRecovery, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)
    try {
      await updatePassword(password)
      setDone(true)
    } catch (err) {
      setError(err.message || '비밀번호 변경에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleContinue = () => {
    clearPasswordRecovery()
  }

  const handleBackToLogin = async () => {
    await signOut()
    clearPasswordRecovery()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-xl border border-gray-200">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 font-sans">새 비밀번호 설정</h2>
          <p className="mt-2 text-sm text-gray-600 font-sans">사용할 새 비밀번호를 입력하세요</p>
        </div>

        {done ? (
          <div className="space-y-6">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-sans">
              비밀번호가 변경되었습니다.
            </div>
            <button
              type="button"
              onClick={handleContinue}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-green-700 hover:bg-green-800 transition-colors duration-200 font-sans"
            >
              계속하기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 font-sans mb-2">새 비밀번호</label>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 font-sans mb-2">새 비밀번호 확인</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={6}
                placeholder="다시 입력해주세요"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-base font-sans"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-sans">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-green-700 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 font-sans"
            >
              {loading ? '변경 중...' : '비밀번호 변경'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium font-sans transition-colors duration-200"
              >
                로그인 화면으로 돌아가기
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
