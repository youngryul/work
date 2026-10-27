import { supabase } from '../config/supabase.js'

/**
 * Claude 연결(MCP) 키 서비스
 * 발급·폐기는 DB 함수(issue_mcp_key / revoke_mcp_key)로만 하고, 원문 키는 발급 직후 한 번만 받는다.
 * 설계: BACKLOG_MCP_KEYS_DESIGN.md
 */

/** 사용 중인 키 최대 개수 (issue_mcp_key 와 동일) */
export const MAX_ACTIVE_MCP_KEYS = 5

/** MCP 서버 주소 */
export const MCP_SERVER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backlog-mcp`

/** Claude Code 에 등록할 서버 이름 */
export const MCP_SERVER_NAME = 'posili-backlog'

/**
 * 내 연결 키 목록 (최근 발급 순, 폐기한 키 포함)
 * @returns {Promise<Array<{ id: string, label: string, key_prefix: string, created_at: string, last_used_at: string|null, revoked_at: string|null }>>}
 */
export async function fetchMcpConnections() {
  const { data, error } = await supabase
    .from('mcp_connections')
    .select('id, label, key_prefix, created_at, last_used_at, revoked_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Claude 연결 키 조회 오류:', error)
    throw new Error(`연결 키를 불러오지 못했습니다: ${error.message}`)
  }

  return data ?? []
}

/**
 * 새 연결 키 발급
 * @param {string} label 키 이름 (예: 'claude.ai', '회사 노트북')
 * @returns {Promise<{ id: string, raw_key: string, key_prefix: string, label: string, created_at: string }>}
 */
export async function issueMcpKey(label) {
  const { data, error } = await supabase.rpc('issue_mcp_key', { p_label: label })

  if (error) {
    console.error('Claude 연결 키 발급 오류:', error)
    throw new Error(error.message)
  }

  const issued = Array.isArray(data) ? data[0] : data
  if (!issued?.raw_key) throw new Error('키를 발급하지 못했습니다.')
  return issued
}

/**
 * 연결 키 폐기 (되돌릴 수 없음)
 * @param {string} id
 */
export async function revokeMcpKey(id) {
  const { error } = await supabase.rpc('revoke_mcp_key', { p_id: id })

  if (error) {
    console.error('Claude 연결 키 폐기 오류:', error)
    throw new Error(error.message)
  }
}

/**
 * claude.ai 커스텀 커넥터에 넣을 URL (claude.ai 는 헤더를 넣을 수 없어 URL에 키를 담는다)
 * @param {string} rawKey
 */
export function buildConnectorUrl(rawKey) {
  return `${MCP_SERVER_URL}?key=${rawKey}`
}

/**
 * Claude Code 등록 명령어 (URL에 키가 남지 않도록 헤더 사용, 모든 프로젝트에서 쓰도록 user 범위)
 * --header 는 값을 여러 개 받으므로 다른 옵션은 반드시 그 앞에 둔다.
 * @param {string} rawKey
 */
export function buildClaudeCodeCommand(rawKey) {
  return `claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${MCP_SERVER_URL} --header "Authorization: Bearer ${rawKey}"`
}
