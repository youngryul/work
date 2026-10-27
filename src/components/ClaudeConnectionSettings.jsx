import { useState, useEffect, useCallback } from 'react'
import {
  MAX_ACTIVE_MCP_KEYS,
  fetchMcpConnections,
  issueMcpKey,
  revokeMcpKey,
  buildConnectorUrl,
  buildClaudeCodeCommand,
} from '../services/mcpConnectionService.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'
import ClaudeConnectionGuideModal from './ClaudeConnectionGuideModal.jsx'
import ClaudeConnectionPrivacyNotice from './ClaudeConnectionPrivacyNotice.jsx'

/** 키 이름 최대 길이 (issue_mcp_key 와 동일) */
const LABEL_MAX_LENGTH = 50

/**
 * 날짜·시간을 한국어 짧은 형식으로
 * @param {string|null} isoString
 */
function formatDateTime(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text)
    showToast(`${label}을(를) 복사했어요.`, TOAST_TYPES.SUCCESS)
  } catch {
    showToast('복사하지 못했어요. 직접 선택해서 복사해 주세요.', TOAST_TYPES.ERROR)
  }
}

/**
 * 복사 버튼이 붙은 한 줄 값
 * @param {{ title: string, description?: string, value: string }} props
 */
function CopyField({ title, description, value }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <button
          type="button"
          onClick={() => copyText(value, title)}
          className="shrink-0 px-3 py-1 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          복사
        </button>
      </div>
      {description && <p className="text-xs text-gray-500 mb-1">{description}</p>}
      <code className="block w-full px-3 py-2 text-xs bg-gray-900 text-green-200 rounded-md break-all select-all">
        {value}
      </code>
    </div>
  )
}

/**
 * 설정 › Claude 연결: 연결 키 발급·목록·폐기
 * 원문 키는 발급 직후 한 번만 보여주고, 서버에는 해시만 남는다.
 */
export default function ClaudeConnectionSettings() {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [issuing, setIssuing] = useState(false)
  // 방금 발급한 키 (화면을 벗어나면 다시 볼 수 없음)
  const [issuedKey, setIssuedKey] = useState(null)
  const [revokingId, setRevokingId] = useState(null)
  const [showRevoked, setShowRevoked] = useState(false)
  // 연결 가이드 모달에서 처음 보여줄 탭 (null 이면 닫힘)
  const [guideTab, setGuideTab] = useState(null)
  // 개인정보 고지 확인 (발급 전 필수)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const closeGuide = useCallback(() => setGuideTab(null), [])

  const loadConnections = useCallback(async () => {
    try {
      setConnections(await fetchMcpConnections())
    } catch (error) {
      showToast(error.message, TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConnections()
  }, [loadConnections])

  const activeConnections = connections.filter((c) => !c.revoked_at)
  const revokedConnections = connections.filter((c) => c.revoked_at)
  const reachedLimit = activeConnections.length >= MAX_ACTIVE_MCP_KEYS

  const handleIssue = async (event) => {
    event.preventDefault()
    if (issuing || reachedLimit || !privacyAgreed) return
    setIssuing(true)
    try {
      const issued = await issueMcpKey(label.trim())
      setIssuedKey(issued)
      setLabel('')
      await loadConnections()
    } catch (error) {
      showToast(error.message, TOAST_TYPES.ERROR)
    } finally {
      setIssuing(false)
    }
  }

  const handleRevoke = async (connection) => {
    const confirmed = window.confirm(
      `'${connection.label}' 키를 폐기할까요?\n이 키로 연결한 Claude는 바로 포실이에 접근할 수 없게 되고, 되돌릴 수 없어요.`,
    )
    if (!confirmed) return
    setRevokingId(connection.id)
    try {
      await revokeMcpKey(connection.id)
      if (issuedKey?.id === connection.id) setIssuedKey(null)
      showToast('키를 폐기했어요.', TOAST_TYPES.SUCCESS)
      await loadConnections()
    } catch (error) {
      showToast(error.message, TOAST_TYPES.ERROR)
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-2xl font-bold text-gray-800">Claude 연결</h2>
        <button
          type="button"
          onClick={() => setGuideTab('claude-ai')}
          className="shrink-0 px-3 py-1.5 text-sm font-semibold rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          ❓ 연결 방법 보기
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        연결 키를 발급해 Claude(claude.ai, Claude Code)에 등록하면, 대화하면서 포실이 백로그에 할 일을 넣고 조회할 수 있어요.
        키는 기기나 앱마다 따로 만들어 두면 하나만 골라 폐기할 수 있어요.
      </p>

      {/* 개인정보 고지 */}
      <div className="mb-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
        <p className="text-sm font-semibold text-gray-800 mb-2">🔒 연결하면 이렇게 쓰여요</p>
        <ClaudeConnectionPrivacyNotice />
        <label className="flex items-center gap-2 mt-3 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={privacyAgreed}
            onChange={(e) => setPrivacyAgreed(e.target.checked)}
            className="w-4 h-4"
          />
          위 내용을 확인했어요
        </label>
      </div>

      {/* 발급 */}
      <form onSubmit={handleIssue} className="flex flex-col sm:flex-row gap-2 mb-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={LABEL_MAX_LENGTH}
          placeholder="키 이름 (예: claude.ai, 회사 노트북 Claude Code)"
          disabled={issuing || reachedLimit}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={issuing || reachedLimit || !privacyAgreed}
          title={privacyAgreed ? undefined : '위 내용을 먼저 확인해 주세요'}
          className="px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {issuing ? '발급 중…' : '새 키 발급'}
        </button>
      </form>
      <p className="text-xs text-gray-500 mb-6">
        사용 중인 키 {activeConnections.length} / {MAX_ACTIVE_MCP_KEYS}개
        {reachedLimit && ' · 쓰지 않는 키를 폐기하면 새로 발급할 수 있어요.'}
      </p>

      {/* 방금 발급한 키 (한 번만 표시) */}
      {issuedKey && (
        <div className="mb-8 p-4 rounded-lg border-2 border-amber-300 bg-amber-50 space-y-4">
          <div>
            <p className="font-semibold text-amber-900">‘{issuedKey.label}’ 키를 발급했어요</p>
            <p className="text-sm text-amber-800">
              이 키는 지금 한 번만 보여요. 아래 값을 Claude에 등록해 두세요. 키는 비밀번호처럼 다른 사람에게 보여주지 마세요.
            </p>
          </div>

          <div>
            <CopyField
              title="claude.ai 커넥터 URL"
              description="claude.ai › 설정 › 커넥터 › 커스텀 커넥터 추가 › 원격 MCP 서버 URL에 붙여 넣어요."
              value={buildConnectorUrl(issuedKey.raw_key)}
            />
            <button
              type="button"
              onClick={() => setGuideTab('claude-ai')}
              className="mt-1 text-xs text-blue-700 underline"
            >
              claude.ai 연결 방법 자세히 보기
            </button>
          </div>
          <div>
            <CopyField
              title="Claude Code 명령어"
              description="터미널에서 실행해요. URL 대신 헤더로 키를 보내서 설정 파일에 주소만 남아요."
              value={buildClaudeCodeCommand(issuedKey.raw_key)}
            />
            <button
              type="button"
              onClick={() => setGuideTab('claude-code')}
              className="mt-1 text-xs text-blue-700 underline"
            >
              Claude Code 연결 방법 자세히 보기
            </button>
          </div>
          <CopyField title="연결 키" value={issuedKey.raw_key} />

          <div className="text-right">
            <button
              type="button"
              onClick={() => setIssuedKey(null)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700"
            >
              등록했어요, 닫기
            </button>
          </div>
        </div>
      )}

      {/* 사용 중인 키 */}
      <h3 className="text-lg font-semibold text-gray-800 mb-3">사용 중인 키</h3>
      {loading ? (
        <p className="text-sm text-gray-400 py-4">불러오는 중…</p>
      ) : activeConnections.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">아직 발급한 키가 없어요.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
          {activeConnections.map((connection) => (
            <li key={connection.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate">{connection.label}</p>
                <p className="text-xs text-gray-500">
                  <code className="text-gray-600">{connection.key_prefix}…</code>
                  {' · '}발급 {formatDateTime(connection.created_at)}
                </p>
                <p className="text-xs text-gray-500">
                  {connection.last_used_at
                    ? `마지막 사용 ${formatDateTime(connection.last_used_at)}`
                    : '아직 사용하지 않았어요'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(connection)}
                disabled={revokingId === connection.id}
                className="shrink-0 px-3 py-1.5 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {revokingId === connection.id ? '폐기 중…' : '폐기'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 폐기한 키 */}
      {revokedConnections.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowRevoked((v) => !v)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {showRevoked ? '▾' : '▸'} 폐기한 키 {revokedConnections.length}개
          </button>
          {showRevoked && (
            <ul className="mt-2 space-y-1">
              {revokedConnections.map((connection) => (
                <li key={connection.id} className="text-xs text-gray-400">
                  <span className="line-through">{connection.label}</span>
                  {' · '}
                  <code>{connection.key_prefix}…</code>
                  {' · '}폐기 {formatDateTime(connection.revoked_at)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ClaudeConnectionGuideModal
        isOpen={guideTab !== null}
        initialTab={guideTab ?? 'claude-ai'}
        onClose={closeGuide}
      />
    </div>
  )
}
