#!/usr/bin/env node
/**
 * 포실이 MCP A안 연결 테스트 (A안 10)
 *
 * 서로 다른 두 계정에서 발급한 연결 키로 인증·사용자 분리·한도를 확인한다.
 * 기본 실행은 데이터를 바꾸지 않는다. --write 를 주면 계정 A 백로그에 테스트 할 일 1개를 넣는다.
 *
 * 사용법 (PowerShell 예):
 *   $env:MCP_KEY_A="psl_..."; $env:MCP_KEY_B="psl_..."; node scripts/test-mcp-connection.mjs
 * 선택 환경 변수:
 *   MCP_REVOKED_KEY  폐기한 키 (403 확인)
 *   MCP_URL          서버 주소 (기본: VITE_SUPABASE_URL/functions/v1/backlog-mcp)
 * 선택 옵션:
 *   --write       계정 A에 테스트 할 일을 넣고, B에서는 안 보이는지 확인
 *   --rate-limit  계정 B 키로 도구를 31번 불러 분당 한도(30회)를 확인 (B 키는 1분 동안 막힘)
 */
import { readFileSync } from 'node:fs'

const TEST_TASK_TITLE = '[MCP 테스트] 지워도 되는 할 일'
const TOOL_CALLS_PER_MINUTE = 30

/** .env 에서 VITE_SUPABASE_URL 읽기 (환경 변수에 없을 때) */
function readSupabaseUrl() {
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL
  try {
    const line = readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('VITE_SUPABASE_URL='))
    return line?.split('=')[1]?.trim().replace(/^["']|["']$/g, '')
  } catch {
    return undefined
  }
}

const serverUrl = process.env.MCP_URL || `${readSupabaseUrl()}/functions/v1/backlog-mcp`
const keyA = process.env.MCP_KEY_A
const keyB = process.env.MCP_KEY_B
const revokedKey = process.env.MCP_REVOKED_KEY
const args = new Set(process.argv.slice(2))

if (!keyA || !keyB || serverUrl.startsWith('undefined')) {
  console.error('MCP_KEY_A, MCP_KEY_B 환경 변수와 서버 주소(.env 의 VITE_SUPABASE_URL 또는 MCP_URL)가 필요합니다.')
  process.exit(1)
}

let failures = 0
let requestId = 0

function check(name, passed, detail = '') {
  console.log(`${passed ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!passed) failures += 1
}

/**
 * JSON-RPC 요청
 * @param {string} key
 * @param {'url'|'header'} mode 키 전달 방식
 */
async function rpc(key, method, params = {}, mode = 'header') {
  const url = mode === 'url' ? `${serverUrl}?key=${encodeURIComponent(key)}` : serverUrl
  const headers = { 'Content-Type': 'application/json' }
  if (mode === 'header') headers.Authorization = `Bearer ${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

/** 도구 호출 결과 텍스트와 오류 여부 */
async function callTool(key, name, toolArgs = {}) {
  const { status, body } = await rpc(key, 'tools/call', { name, arguments: toolArgs })
  const text = body?.result?.content?.[0]?.text ?? JSON.stringify(body)
  return { status, text, isError: status !== 200 || body?.result?.isError === true }
}

console.log(`서버: ${serverUrl}\n`)

// 1. 인증
const urlAuth = await rpc(keyA, 'tools/list', {}, 'url')
check('A 키 · URL 방식으로 도구 목록', urlAuth.status === 200 && Array.isArray(urlAuth.body?.result?.tools))

const headerAuth = await rpc(keyA, 'tools/list', {}, 'header')
check('A 키 · Authorization 헤더 방식으로 도구 목록', headerAuth.status === 200)

const bAuth = await rpc(keyB, 'tools/list')
check('B 키 · 도구 목록', bAuth.status === 200)

const invalid = await rpc('psl_0000000000000000000000000000000000000000000000000000000000000000', 'tools/list')
check('없는 키는 403', invalid.status === 403, `status ${invalid.status}`)

if (revokedKey) {
  const revoked = await rpc(revokedKey, 'tools/list')
  check('폐기한 키는 403', revoked.status === 403, `status ${revoked.status}`)
} else {
  console.log('⏭️  폐기한 키 확인 건너뜀 (MCP_REVOKED_KEY 없음)')
}

// 2. 사용자 분리
const categoriesA = await callTool(keyA, 'list_categories')
const categoriesB = await callTool(keyB, 'list_categories')
check('A 카테고리 조회', !categoriesA.isError, categoriesA.text)
check('B 카테고리 조회', !categoriesB.isError, categoriesB.text)

const backlogA = await callTool(keyA, 'list_backlog', { limit: 200 })
const todayA = await callTool(keyA, 'list_today_tasks')
const taskIdOfA = `${backlogA.text}\n${todayA.text}`.match(/\(id: ([0-9a-f-]{36})\)/)?.[1]

if (taskIdOfA) {
  // B 키로 A의 할 일 메모를 고치려 하면 찾을 수 없어야 한다 (A 데이터는 바뀌지 않음)
  const crossWrite = await callTool(keyB, 'update_task_memo', { task_id: taskIdOfA, memo: 'B가 쓴 메모' })
  check('B 키로 A의 할 일 메모 수정 불가', crossWrite.isError && crossWrite.text.includes('찾을 수 없습니다'), crossWrite.text)
} else {
  console.log('⏭️  교차 수정 확인 건너뜀 (A 계정에 할 일이 없음)')
}

if (args.has('--write')) {
  const added = await callTool(keyA, 'add_backlog_tasks', { tasks: [{ title: TEST_TASK_TITLE }] })
  check('A 키로 테스트 할 일 추가', !added.isError, added.text.split('\n')[0])

  const backlogAfterA = await callTool(keyA, 'list_backlog', { limit: 200 })
  const backlogAfterB = await callTool(keyB, 'list_backlog', { limit: 200 })
  check('A 백로그에 테스트 할 일이 보임', backlogAfterA.text.includes(TEST_TASK_TITLE))
  check('B 백로그에는 안 보임', !backlogAfterB.text.includes(TEST_TASK_TITLE))
  console.log(`   ↳ 확인 후 A 계정에서 '${TEST_TASK_TITLE}'를 지워 주세요.`)
}

// 3. 분당 한도
if (args.has('--rate-limit')) {
  let blockedAt = null
  for (let i = 1; i <= TOOL_CALLS_PER_MINUTE + 1; i += 1) {
    const result = await callTool(keyB, 'list_categories')
    if (result.isError && result.text.includes('요청이 너무 많습니다')) {
      blockedAt = i
      break
    }
  }
  // 앞의 테스트에서 B 키를 이미 몇 번 썼으므로 31번째 이전에 막혀도 정상
  check(`B 키 분당 한도(${TOOL_CALLS_PER_MINUTE}회) 적용`, blockedAt !== null, blockedAt ? `${blockedAt}번째 호출에서 막힘` : '막히지 않음')
} else {
  console.log('⏭️  분당 한도 확인 건너뜀 (--rate-limit)')
}

console.log(failures === 0 ? '\n모든 확인을 통과했어요.' : `\n${failures}개 확인이 실패했어요.`)
process.exit(failures === 0 ? 0 : 1)
