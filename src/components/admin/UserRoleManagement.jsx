import { useState, useEffect } from 'react'
import { getAllUsersWithRoles, setUserRole } from '../../services/userRoleService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import { useAuth } from '../../contexts/AuthContext.jsx'

/**
 * 관리자 권한 관리 컴포넌트
 * 전체 유저 목록을 보여주고 admin / regular 역할을 변경할 수 있음
 */
export default function UserRoleManagement() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingIds, setSavingIds] = useState(new Set())

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await getAllUsersWithRoles()
      setUsers(data)
    } catch (error) {
      showToast('유저 목록을 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (targetUserId, newRole) => {
    // 자기 자신의 role 변경 방지
    if (targetUserId === user?.id) {
      showToast('자신의 권한은 변경할 수 없습니다.', TOAST_TYPES.ERROR)
      return
    }

    setSavingIds(prev => new Set([...prev, targetUserId]))
    try {
      await setUserRole(targetUserId, newRole)
      setUsers(prev =>
        prev.map(u => u.userId === targetUserId ? { ...u, role: newRole } : u)
      )
      const roleLabel = { admin: '관리자', superuser: '슈퍼유저', regular: '일반' }[newRole] || newRole
      showToast(`${roleLabel} 권한으로 변경했습니다.`, TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast('권한 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(targetUserId); return s })
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-2xl text-gray-500 font-sans">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 font-sans space-y-1">
        <p className="text-sm text-blue-800">
          <span className="font-semibold text-blue-700">관리자</span>: 전체 메뉴 + 관리자 페이지 접근 가능
        </p>
        <p className="text-sm text-blue-800">
          <span className="font-semibold text-purple-700">슈퍼유저</span>: 전체 메뉴 접근 가능 (관리자 페이지 제외)
        </p>
        <p className="text-sm text-blue-800">
          <span className="font-semibold text-green-700">일반</span>: 관리자가 설정한 메뉴만 표시 (기본: 오늘·백로그·할일·일기 달력·뽑기 가챠·공지·마이페이지·설정)
        </p>
        <p className="text-sm text-indigo-800 mt-2">
          메뉴 구성은 <strong>메뉴 설정</strong> 탭에서 역할별로 변경할 수 있습니다.
        </p>
      </div>

      {/* 유저 목록 */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 font-sans">
            전체 유저 ({users.length}명)
          </h3>
          <button
            onClick={loadUsers}
            className="text-sm text-gray-500 hover:text-gray-700 font-sans px-3 py-1 rounded hover:bg-gray-100"
          >
            새로고침
          </button>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-12 text-gray-400 font-sans">
            유저가 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map((u) => {
              const isSelf = u.userId === user?.id
              const isSaving = savingIds.has(u.userId)

              return (
                <div
                  key={u.userId}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-green-700 font-semibold text-sm font-sans">
                        {(u.email?.[0] || '?').toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 font-sans truncate">
                        {u.email}
                        {isSelf && (
                          <span className="ml-2 text-xs text-gray-400">(나)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 font-sans truncate">{u.userId}</p>
                    </div>
                  </div>

                  {/* 역할 선택 */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {isSaving ? (
                      <span className="text-sm text-gray-400 font-sans">저장 중...</span>
                    ) : (
                      <>
                        {[
                          { value: 'admin',     label: '관리자', active: 'bg-blue-500 text-white',   hover: 'hover:bg-blue-100 hover:text-blue-700' },
                          { value: 'superuser', label: '슈퍼유저', active: 'bg-purple-500 text-white', hover: 'hover:bg-purple-100 hover:text-purple-700' },
                          { value: 'regular',   label: '일반',   active: 'bg-green-500 text-white',  hover: 'hover:bg-green-100 hover:text-green-700' },
                        ].map(({ value, label, active, hover }) => (
                          <button
                            key={value}
                            onClick={() => handleRoleChange(u.userId, value)}
                            disabled={isSelf || u.role === value}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold font-sans transition-colors ${
                              u.role === value
                                ? active + ' cursor-default'
                                : isSelf
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-gray-100 text-gray-600 ' + hover
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
