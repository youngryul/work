import { useEffect, useState } from 'react'
import { getAllUsersWithRoles } from '../../services/userRoleService.js'
import {
  getAiTokenSettings,
  getTokenBalancesForUsers,
  setUserAiTokenBalance,
  updateAiTokenSettings,
} from '../../services/aiTokenService.js'
import {
  getJellyBalancesForUsers,
  setUserJellyBalance,
} from '../../services/jellyService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 관리자: AI 토큰·젤리 설정 및 유저별 잔액 관리
 */
export default function AiTokenManagement() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [defaultBalance, setDefaultBalance] = useState(10)
  const [generationCost, setGenerationCost] = useState(3)
  const [backlogAssistantCost, setBacklogAssistantCost] = useState(1)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isSavingAllBalances, setIsSavingAllBalances] = useState(false)
  const [draftTokenBalances, setDraftTokenBalances] = useState({})
  const [draftJellyBalances, setDraftJellyBalances] = useState({})

  const load = async () => {
    setLoading(true)
    try {
      const [users, settings] = await Promise.all([
        getAllUsersWithRoles(),
        getAiTokenSettings(),
      ])
      setDefaultBalance(settings.defaultBalance)
      setGenerationCost(settings.generationCost)
      setBacklogAssistantCost(settings.backlogAssistantCost)

      const [tokenRows, jellyRows] = await Promise.all([
        getTokenBalancesForUsers(users),
        getJellyBalancesForUsers(users),
      ])

      const jellyMap = new Map(jellyRows.map((row) => [row.userId, row.balance]))
      const merged = tokenRows.map((row) => ({
        ...row,
        jellyBalance: jellyMap.get(row.userId) ?? 0,
      }))

      setRows(merged)
      const tokenDrafts = {}
      const jellyDrafts = {}
      merged.forEach((row) => {
        tokenDrafts[row.userId] = String(row.balance)
        jellyDrafts[row.userId] = String(row.jellyBalance)
      })
      setDraftTokenBalances(tokenDrafts)
      setDraftJellyBalances(jellyDrafts)
    } catch {
      showToast('토큰·젤리 목록을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSaveSettings = async () => {
    const nextDefault = Number(defaultBalance)
    const nextCost = Number(generationCost)
    const nextBacklogCost = Number(backlogAssistantCost)
    if (Number.isNaN(nextDefault) || nextDefault < 0) {
      showToast('기본 토큰은 0 이상의 숫자여야 합니다.', TOAST_TYPES.ERROR)
      return
    }
    if (Number.isNaN(nextCost) || nextCost <= 0) {
      showToast('이미지 생성 비용은 1 이상의 숫자여야 합니다.', TOAST_TYPES.ERROR)
      return
    }
    if (Number.isNaN(nextBacklogCost) || nextBacklogCost <= 0) {
      showToast('백로그 어시스턴트 비용은 1 이상의 숫자여야 합니다.', TOAST_TYPES.ERROR)
      return
    }

    setIsSavingSettings(true)
    try {
      await updateAiTokenSettings({
        defaultBalance: nextDefault,
        generationCost: nextCost,
        backlogAssistantCost: nextBacklogCost,
      })
      showToast('전역 토큰 설정을 저장했습니다.', TOAST_TYPES.SUCCESS)
      await load()
    } catch (error) {
      showToast(error?.message || '설정 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleSaveAllUserBalances = async () => {
    for (const row of rows) {
      const nextToken = Number(draftTokenBalances[row.userId])
      const nextJelly = Number(draftJellyBalances[row.userId])
      if (Number.isNaN(nextToken) || nextToken < 0) {
        showToast(`"${row.email}"의 토큰은 0 이상의 숫자여야 합니다.`, TOAST_TYPES.ERROR)
        return
      }
      if (Number.isNaN(nextJelly) || nextJelly < 0) {
        showToast(`"${row.email}"의 젤리는 0 이상의 숫자여야 합니다.`, TOAST_TYPES.ERROR)
        return
      }
    }

    const changedTokenCount = rows.filter(
      (row) => Number(draftTokenBalances[row.userId]) !== row.balance,
    ).length
    const changedJellyCount = rows.filter(
      (row) => Number(draftJellyBalances[row.userId]) !== row.jellyBalance,
    ).length

    if (changedTokenCount === 0 && changedJellyCount === 0) {
      showToast('변경된 잔액이 없습니다.', TOAST_TYPES.INFO)
      return
    }

    setIsSavingAllBalances(true)
    try {
      await Promise.all(
        rows.flatMap((row) => {
          const tasks = []
          if (Number(draftTokenBalances[row.userId]) !== row.balance) {
            tasks.push(setUserAiTokenBalance(row.userId, Number(draftTokenBalances[row.userId])))
          }
          if (Number(draftJellyBalances[row.userId]) !== row.jellyBalance) {
            tasks.push(setUserJellyBalance(row.userId, Number(draftJellyBalances[row.userId])))
          }
          return tasks
        }),
      )
      showToast(
        `토큰 ${changedTokenCount}명 · 젤리 ${changedJellyCount}명 잔액을 저장했습니다.`,
        TOAST_TYPES.SUCCESS,
      )
      await load()
    } catch (error) {
      showToast(error?.message || '잔액 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsSavingAllBalances(false)
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
    <div className="space-y-6 font-sans">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1">
        <p className="text-sm text-amber-900">
          일기 AI 이미지 생성 시 <strong>생성 비용</strong>만큼 토큰이 차감됩니다.
        </p>
        <p className="text-sm text-amber-800">
          젤리는 포실이·농장·가챠에 사용됩니다. 신규 유저는 <strong>기본 토큰</strong>으로 시작하며,
          일기 이미지·백로그 AI 어시스턴트에 토큰이 소모됩니다.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">AI 토큰 전역 설정</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <label className="block">
            <span className="text-sm text-gray-600 mb-1 block">신규 유저 기본 토큰</span>
            <input
              type="number"
              min={0}
              value={defaultBalance}
              onChange={(e) => setDefaultBalance(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-600 mb-1 block">이미지 1회 생성 비용</span>
            <input
              type="number"
              min={1}
              value={generationCost}
              onChange={(e) => setGenerationCost(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="text-sm text-gray-600 mb-1 block">백로그 AI 분석 1회 비용</span>
            <input
              type="number"
              min={1}
              value={backlogAssistantCost}
              onChange={(e) => setBacklogAssistantCost(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={isSavingSettings}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isSavingSettings ? '저장 중...' : '전역 설정 저장'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            유저별 토큰·젤리 ({rows.length}명)
          </h3>
          <p className="text-sm text-gray-500 mt-1">수정 후 하단 저장 버튼으로 한 번에 반영합니다.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-700">이메일</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-700">보유 토큰</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-700">보유 젤리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draftToken = draftTokenBalances[row.userId] ?? String(row.balance)
                const draftJelly = draftJellyBalances[row.userId] ?? String(row.jellyBalance)
                const tokenChanged = Number(draftToken) !== row.balance
                const jellyChanged = Number(draftJelly) !== row.jellyBalance
                const isChanged = tokenChanged || jellyChanged
                return (
                  <tr
                    key={row.userId}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${isChanged ? 'bg-amber-50/50' : ''}`}
                  >
                    <td className="px-6 py-3 text-gray-800">{row.email}</td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        min={0}
                        value={draftToken}
                        onChange={(e) =>
                          setDraftTokenBalances((prev) => ({
                            ...prev,
                            [row.userId]: e.target.value,
                          }))
                        }
                        className="w-24 px-2 py-1 border border-gray-300 rounded"
                      />
                      {tokenChanged && (
                        <span className="ml-2 text-xs text-amber-700">변경됨</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        min={0}
                        value={draftJelly}
                        onChange={(e) =>
                          setDraftJellyBalances((prev) => ({
                            ...prev,
                            [row.userId]: e.target.value,
                          }))
                        }
                        className="w-24 px-2 py-1 border border-gray-300 rounded"
                      />
                      {jellyChanged && (
                        <span className="ml-2 text-xs text-pink-700">변경됨</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={handleSaveAllUserBalances}
            disabled={isSavingAllBalances || rows.length === 0}
            className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {isSavingAllBalances ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
