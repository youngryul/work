import { useEffect, useState } from 'react'
import { buildMenuLabelMap, USER_ROLE_LABELS } from '../../constants/roleMenuPermissions.js'
import { getUserStatistics } from '../../services/adminStatisticsService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * @param {string|null} iso
 * @returns {string}
 */
function formatDateTime(iso) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

/**
 * 사용자 통계 (최근 접속·사용 메뉴 목록)
 */
export default function UserStatistics() {
  const [statistics, setStatistics] = useState(null)
  const [loading, setLoading] = useState(true)
  const menuLabels = buildMenuLabelMap()

  useEffect(() => {
    loadStatistics()
  }, [])

  const loadStatistics = async () => {
    setLoading(true)
    try {
      const data = await getUserStatistics()
      setStatistics(data)
    } catch (error) {
      console.error('사용자 통계 로드 실패:', error)
      showToast('사용자 통계를 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  /**
   * @param {string} viewId
   */
  const getMenuLabel = (viewId) => menuLabels[viewId] || viewId

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-2xl text-gray-500 font-sans">로딩 중...</div>
      </div>
    )
  }

  if (!statistics) {
    return (
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
        <p className="text-base text-red-800 font-sans">통계 데이터를 불러올 수 없습니다.</p>
      </div>
    )
  }

  const users = statistics.users || []

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 max-w-sm">
        <h3 className="text-lg font-semibold text-gray-700 mb-2 font-sans">총 사용자 수</h3>
        <p className="text-4xl font-bold text-blue-600 font-sans">{statistics.totalUsers}</p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-gray-800 font-sans">
            전체 사용자
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({users.length}명 · 최근 접속순)
            </span>
          </h3>
          <button
            type="button"
            onClick={loadStatistics}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 font-sans"
          >
            새로고침
          </button>
        </div>

        {users.length === 0 ? (
          <p className="p-6 text-center text-gray-500 font-sans">등록된 사용자가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="min-w-full text-sm font-sans">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="text-left text-gray-600">
                  <th className="px-4 py-3 font-semibold w-14">#</th>
                  <th className="px-4 py-3 font-semibold">이메일</th>
                  <th className="px-4 py-3 font-semibold">권한</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">최근 접속</th>
                  <th className="px-4 py-3 font-semibold">사용한 메뉴</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">회원가입일</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => {
                  const lastAccessAt = user.lastSeenAt || user.lastSignInAt
                  const usedViews = user.usedViews?.length
                    ? user.usedViews
                    : user.lastView
                      ? [user.lastView]
                      : []
                  return (
                    <tr
                      key={user.userId}
                      className="border-t border-gray-100 hover:bg-gray-50 align-top"
                    >
                      <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium break-all">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : user.role === 'superuser'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {USER_ROLE_LABELS[user.role] || user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <div>{formatDateTime(lastAccessAt)}</div>
                        {user.lastView ? (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {getMenuLabel(user.lastView)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {usedViews.length === 0 ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-md">
                            {usedViews.map((viewId) => (
                              <span
                                key={viewId}
                                className="inline-block rounded-full bg-sky-50 text-sky-800 px-2 py-0.5 text-xs"
                              >
                                {getMenuLabel(viewId)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDateTime(user.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
