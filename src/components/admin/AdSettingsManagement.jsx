import { useState, useEffect } from 'react'
import { getAllUsersWithRoles } from '../../services/userRoleService.js'
import { getAdsEnabledMapForUsers, setAdsEnabledForUser } from '../../services/adSettingsService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import { useAuth } from '../../contexts/AuthContext.jsx'

/**
 * 관리자: 유저별 애드센스 노출 on/off
 */
export default function AdSettingsManagement() {
  const { user, refreshAdsPreference } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingIds, setSavingIds] = useState(new Set())

  const load = async () => {
    setLoading(true)
    try {
      const users = await getAllUsersWithRoles()
      const ids = users.map((u) => u.userId)
      const adsMap = await getAdsEnabledMapForUsers(ids)
      setRows(
        users.map((u) => ({
          ...u,
          adsEnabled: adsMap.get(u.userId) !== false,
        })),
      )
    } catch (e) {
      showToast('광고 설정 목록을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleToggle = async (targetUserId, nextEnabled) => {
    setSavingIds((prev) => new Set([...prev, targetUserId]))
    try {
      await setAdsEnabledForUser(targetUserId, nextEnabled)
      setRows((prev) =>
        prev.map((r) =>
          r.userId === targetUserId ? { ...r, adsEnabled: nextEnabled } : r,
        ),
      )
      showToast(
        nextEnabled ? '해당 사용자에게 광고를 표시합니다.' : '해당 사용자에게 광고를 숨깁니다.',
        TOAST_TYPES.SUCCESS,
      )
      if (user?.id === targetUserId) {
        await refreshAdsPreference()
      }
    } catch {
      showToast('저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setSavingIds((prev) => {
        const n = new Set(prev)
        n.delete(targetUserId)
        return n
      })
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
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 font-sans text-sm text-amber-900 space-y-2">
        <p>
          <span className="font-semibold">유저별 광고</span>를 끄면 해당 계정으로 로그인했을 때
          애드센스 배너가 표시되지 않습니다. 행이 없는 유저는 기본적으로 광고가 켜져 있습니다.
        </p>
        <p className="text-amber-800">
          사이트에 광고를 붙이려면 루트에{' '}
          <code className="bg-amber-100 px-1 rounded">VITE_ADSENSE_CLIENT_ID</code>,{' '}
          <code className="bg-amber-100 px-1 rounded">VITE_ADSENSE_SLOT_ID</code> 를 설정하고,
          (client id는 <code className="bg-amber-100 px-1 rounded">pub-...</code> 또는
          <code className="bg-amber-100 px-1 rounded">ca-pub-...</code> 모두 가능)
          Supabase에 <code className="bg-amber-100 px-1 rounded">user_ad_settings</code> 테이블(마이그레이션 SQL)을 적용하세요.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 font-sans">
            유저별 광고 표시 ({rows.length}명)
          </h3>
          <button
            type="button"
            onClick={load}
            className="text-sm text-gray-500 hover:text-gray-700 font-sans px-3 py-1 rounded hover:bg-gray-100"
          >
            새로고침
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-12 text-gray-400 font-sans">유저가 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map((u) => {
              const isSaving = savingIds.has(u.userId)
              return (
                <div
                  key={u.userId}
                  className="px-6 py-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-gray-600 truncate" title={u.email}>
                      {u.email}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      역할: {u.role === 'admin' ? '관리자' : u.role === 'superuser' ? '슈퍼유저' : '일반'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 font-sans">
                      {u.adsEnabled ? '광고 표시' : '광고 숨김'}
                    </span>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleToggle(u.userId, !u.adsEnabled)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium font-sans transition-colors disabled:opacity-50 ${
                        u.adsEnabled
                          ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {isSaving ? '저장 중…' : u.adsEnabled ? '광고 끄기' : '광고 켜기'}
                    </button>
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
