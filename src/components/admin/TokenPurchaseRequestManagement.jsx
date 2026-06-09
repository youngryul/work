import { useEffect, useState } from 'react'
import { formatKrw } from '../../constants/aiTokenPurchase.js'
import {
  getAllTokenPurchaseRequests,
  updateTokenPurchaseRequestStatus,
} from '../../services/aiTokenPurchaseService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

const STATUS_LABELS = {
  pending: { text: '대기', className: 'bg-amber-100 text-amber-800' },
  completed: { text: '완료', className: 'bg-green-100 text-green-800' },
  rejected: { text: '반려', className: 'bg-red-100 text-red-800' },
}

/**
 * 관리자: AI 토큰 무통장 충전 신청 목록
 */
export default function TokenPurchaseRequestManagement() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [updatingId, setUpdatingId] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await getAllTokenPurchaseRequests()
      setRequests(data)
    } catch {
      showToast('충전 신청 목록을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleStatusChange = async (requestId, status) => {
    setUpdatingId(requestId)
    const targetRequest = requests.find((item) => item.id === requestId)

    try {
      const result = await updateTokenPurchaseRequestStatus({ requestId, status })
      setRequests((prev) =>
        prev.map((item) => (item.id === requestId ? { ...item, status } : item)),
      )

      if (status === 'completed') {
        const emailLabel = result.userEmail || targetRequest?.userEmail || '해당 사용자'
        const added = result.addedTokens ?? targetRequest?.requestedTokens ?? 0
        showToast(
          `${emailLabel}에게 ${added}토큰이 지급되었습니다. (잔액 ${result.newBalance ?? '-'}개)`,
          TOAST_TYPES.SUCCESS,
        )
      } else {
        showToast('상태를 변경했습니다.', TOAST_TYPES.SUCCESS)
      }
    } catch (error) {
      showToast(error?.message || '상태 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setUpdatingId('')
    }
  }

  const filtered = requests.filter(
    (item) => statusFilter === 'all' || item.status === statusFilter,
  )

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-2xl text-gray-500 font-sans">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="text-sm text-purple-900">
          사용자가 제출한 무통장 충전 신청입니다. 입금 확인 후 <strong>완료</strong>를 누르면
          신청 이메일 계정에 신청 토큰이 자동으로 추가됩니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'all', label: '전체' },
          { id: 'pending', label: '대기' },
          { id: 'completed', label: '완료' },
          { id: 'rejected', label: '반려' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              statusFilter === tab.id
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          onClick={load}
          className="ml-auto px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          새로고침
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            충전 신청 ({filtered.length}건)
          </h3>
        </div>

        {filtered.length === 0 ? (
          <p className="px-6 py-12 text-center text-gray-500">신청 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">신청일</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">이메일</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">입금자명</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">입금액</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">신청 토큰</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">상태</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">처리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const statusMeta = STATUS_LABELS[item.status] || STATUS_LABELS.pending
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-gray-800">{item.userEmail || '-'}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{item.depositorName}</td>
                      <td className="px-4 py-3 text-gray-800">{formatKrw(item.depositAmountKrw)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{item.requestedTokens}개</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${statusMeta.className}`}>
                          {statusMeta.text}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.status === 'pending' ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={updatingId === item.id}
                              onClick={() => handleStatusChange(item.id, 'completed')}
                              className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              완료
                            </button>
                            <button
                              type="button"
                              disabled={updatingId === item.id}
                              onClick={() => handleStatusChange(item.id, 'rejected')}
                              className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                            >
                              반려
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
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
