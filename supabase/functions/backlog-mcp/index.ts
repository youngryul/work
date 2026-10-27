// Supabase Edge Function: 포실이 백로그 MCP 서버
// Claude(claude.ai 커스텀 커넥터, Claude Code)에서 대화 내용을 백로그 할 일로 바로 등록하기 위한 MCP 서버
// - 프로토콜: MCP Streamable HTTP (상태 없는 JSON-RPC 응답)
// - 인증: 사용자별 연결 키 psl_... (설계: BACKLOG_MCP_KEYS_DESIGN.md)
//   · Authorization: Bearer psl_... 헤더 (Claude Code 권장, URL에 키가 남지 않음)
//   · URL 쿼리 ?key=psl_... (claude.ai 커스텀 커넥터는 임의 헤더를 넣을 수 없어 URL 키 방식 사용)
//   · 전환 기간: 기존 시크릿 MCP_ACCESS_KEY 와 같으면 MCP_USER_ID 계정으로 동작 (두 시크릿을 지우면 꺼짐)
// - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 Edge Function 에 기본 제공됨
// - 배포: supabase functions deploy backlog-mcp --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const SERVER_INFO = { name: 'posili-backlog', version: '1.2.0' }
const MAX_ITEMS_PER_CALL = 30
const SYSTEM_CATEGORY_DAILY = '일상'

/** 연결 키 접두사 */
const KEY_PREFIX = 'psl_'
/** 키 하나당 도구 호출 분당 한도 */
const TOOL_CALLS_PER_MINUTE = 30
/** 키 하나당 할 일 추가 하루 한도 (한국 시간 기준) */
const TASKS_PER_DAY = 300
/** last_used_at 갱신 간격 (매 요청마다 쓰지 않도록) */
const LAST_USED_UPDATE_INTERVAL_MS = 5 * 60 * 1000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-session-id, mcp-protocol-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)
// 전환 기간용 기존 단일 키 (A안 11에서 시크릿 삭제)
const LEGACY_USER_ID = Deno.env.get('MCP_USER_ID') ?? ''
const LEGACY_ACCESS_KEY = Deno.env.get('MCP_ACCESS_KEY') ?? ''

/** 요청한 사용자 정보. connectionId 가 없으면 기존 단일 키 (한도 미적용) */
type Caller = { userId: string; connectionId: string | null }

/** Claude 에 노출할 도구 목록 */
const TOOLS = [
  {
    name: 'add_backlog_tasks',
    description:
      '포실이 앱의 백로그에 할 일을 추가합니다. 대화에서 나온 할 일들을 한 번에 여러 개 넣을 수 있습니다(최대 30개). ' +
      'category 는 list_categories 로 확인한 이름 중 하나를 쓰고, 없거나 모르면 비워 두면 기본 카테고리가 사용됩니다.',
    inputSchema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          minItems: 1,
          maxItems: MAX_ITEMS_PER_CALL,
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: '할 일 제목 (짧고 실행 가능한 문장)' },
              category: { type: 'string', description: '카테고리 이름 (선택)' },
              memo: { type: 'string', description: '세부 내용, 링크, 참고 메모 (선택, 마크다운 가능)' },
              scheduled_date: {
                type: 'string',
                description: 'YYYY-MM-DD. 지정하면 그 날짜에 오늘 할 일로 자동 이동 (선택)',
              },
            },
            required: ['title'],
          },
        },
      },
      required: ['tasks'],
    },
  },
  {
    name: 'list_backlog',
    description: '포실이 백로그(완료되지 않았고 오늘 할 일이 아닌 항목)를 조회합니다. 중복 등록을 피할 때 사용하세요.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '최대 개수 (기본 50)' },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_today_tasks',
    description: '포실이의 오늘 할 일 목록을 id·완료 여부·메모 일부와 함께 조회합니다. 메모를 수정할 할 일의 id 를 찾을 때 사용하세요.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'update_task_memo',
    description:
      '할 일(오늘 할 일 또는 백로그)의 메모를 수정합니다. task_id 는 list_today_tasks 또는 list_backlog 결과의 id 를 사용합니다. ' +
      "mode 기본값은 'append'(기존 메모 뒤에 덧붙이기)이고, 'replace' 면 메모 전체를 바꿉니다.",
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '할 일 id (uuid)' },
        memo: { type: 'string', description: '추가하거나 교체할 메모 (마크다운 가능)' },
        mode: { type: 'string', enum: ['append', 'replace'], description: "기본 'append'" },
      },
      required: ['task_id', 'memo'],
    },
  },
  {
    name: 'list_categories',
    description: '할 일 카테고리 목록을 조회합니다.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
]

// ===== 인증 =====

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Authorization: Bearer 헤더 → 없으면 ?key= 쿼리 */
function readKey(req: Request): string {
  const auth = req.headers.get('authorization') ?? ''
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (bearer?.startsWith(KEY_PREFIX)) return bearer
  return new URL(req.url).searchParams.get('key')?.trim() ?? ''
}

/** 키로 사용자 찾기. 없거나 폐기된 키면 null */
async function resolveCaller(key: string): Promise<Caller | null> {
  if (!key) return null

  if (key.startsWith(KEY_PREFIX)) {
    const { data, error } = await supabase
      .from('mcp_connections')
      .select('id, user_id, last_used_at')
      .eq('key_hash', await sha256Hex(key))
      .is('revoked_at', null)
      .maybeSingle()
    if (error) throw new Error(`연결 키 확인 실패: ${error.message}`)
    if (!data) return null

    const lastUsed = data.last_used_at ? new Date(data.last_used_at).getTime() : 0
    if (Date.now() - lastUsed > LAST_USED_UPDATE_INTERVAL_MS) {
      // 마지막 사용 시각은 응답을 기다리지 않고 갱신
      supabase
        .from('mcp_connections')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id)
        .then(({ error: updateError }) => {
          if (updateError) console.error('last_used_at 갱신 실패:', updateError.message)
        })
    }
    return { userId: data.user_id, connectionId: data.id }
  }

  if (LEGACY_ACCESS_KEY && LEGACY_USER_ID && key === LEGACY_ACCESS_KEY) {
    return { userId: LEGACY_USER_ID, connectionId: null }
  }
  return null
}

// ===== 사용 한도 =====

/** 한도 안이면 amount 만큼 쓰고 true. 기존 단일 키는 한도 없음 */
async function consume(caller: Caller, bucket: string, amount: number, limit: number): Promise<boolean> {
  if (!caller.connectionId) return true
  const { data, error } = await supabase.rpc('mcp_consume', {
    p_connection_id: caller.connectionId,
    p_bucket: bucket,
    p_amount: amount,
    p_limit: limit,
  })
  if (error) throw new Error(`사용 한도 확인 실패: ${error.message}`)
  return data === true
}

function minuteBucket(): string {
  return `m:${new Date().toISOString().slice(0, 16)}`
}

/** 한국 시간 기준 날짜 YYYY-MM-DD */
function todayKst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

// ===== 도구 =====

/** 사용자 카테고리 이름 목록 (시스템 카테고리 '일상' 포함) */
async function getCategoryNames(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('name')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  if (error) throw new Error(`카테고리 조회 실패: ${error.message}`)
  const names = (data ?? []).map((c: { name: string }) => c.name)
  if (!names.includes(SYSTEM_CATEGORY_DAILY)) names.push(SYSTEM_CATEGORY_DAILY)
  return names
}

/** 기본 카테고리: user_preferences.default_category → 첫 카테고리 → '작업' */
async function getDefaultCategory(userId: string, names: string[]): Promise<string> {
  const { data } = await supabase
    .from('user_preferences')
    .select('default_category')
    .eq('user_id', userId)
    .maybeSingle()
  const preferred = data?.default_category
  if (preferred && names.includes(preferred)) return preferred
  return names.find((n) => n !== SYSTEM_CATEGORY_DAILY) ?? '작업'
}

type TaskInput = { title?: string; category?: string; memo?: string; scheduled_date?: string }

async function addBacklogTasks(caller: Caller, args: { tasks?: TaskInput[] }) {
  const tasks = Array.isArray(args?.tasks) ? args.tasks : []
  if (tasks.length === 0) throw new Error('tasks 가 비어 있습니다.')
  if (tasks.length > MAX_ITEMS_PER_CALL) throw new Error(`한 번에 최대 ${MAX_ITEMS_PER_CALL}개까지 추가할 수 있습니다.`)

  const names = await getCategoryNames(caller.userId)
  const defaultCategory = await getDefaultCategory(caller.userId, names)
  const now = Date.now()

  const rows = tasks.map((t, i) => {
    const title = (t.title ?? '').trim()
    if (!title) throw new Error(`${i + 1}번째 항목의 title 이 비어 있습니다.`)
    const row: Record<string, unknown> = {
      title,
      completed: false,
      istoday: false,
      category: t.category && names.includes(t.category) ? t.category : defaultCategory,
      // 같은 밀리초에 여러 개가 들어가도 입력 순서가 유지되도록 1ms 씩 증가
      createdat: now + i,
      user_id: caller.userId,
      priority: 0,
    }
    if (t.memo?.trim()) row.memo = t.memo.trim()
    if (t.scheduled_date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t.scheduled_date)) {
        throw new Error(`${i + 1}번째 항목의 scheduled_date 형식이 잘못되었습니다 (YYYY-MM-DD).`)
      }
      row.scheduled_date = t.scheduled_date
    }
    return row
  })

  // 입력 검증이 끝난 뒤에 하루 한도를 쓴다 (잘못된 요청이 한도를 깎지 않도록)
  if (!(await consume(caller, `d:${todayKst()}:tasks`, rows.length, TASKS_PER_DAY))) {
    throw new Error(`할 일은 하루 ${TASKS_PER_DAY}개까지 추가할 수 있습니다. 내일 다시 시도해 주세요.`)
  }

  const { data, error } = await supabase.from('tasks').insert(rows).select('id, title, category, scheduled_date')
  if (error) throw new Error(`할 일 추가 실패: ${error.message}`)

  const lines = (data ?? []).map(
    (t: { title: string; category: string; scheduled_date: string | null }) =>
      `- [${t.category}] ${t.title}${t.scheduled_date ? ` (예정 ${t.scheduled_date})` : ''}`,
  )
  return `백로그에 ${lines.length}개를 추가했습니다.\n${lines.join('\n')}`
}

async function listBacklog(caller: Caller, args: { limit?: number }) {
  const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 200)
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, category, memo, scheduled_date, createdat')
    .eq('user_id', caller.userId)
    .eq('completed', false)
    .eq('istoday', false)
    .order('createdat', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`백로그 조회 실패: ${error.message}`)
  if (!data || data.length === 0) return '백로그가 비어 있습니다.'
  return data
    .map(
      (t: { id: string; title: string; category: string; scheduled_date: string | null }) =>
        `- [${t.category}] ${t.title}${t.scheduled_date ? ` (예정 ${t.scheduled_date})` : ''} (id: ${t.id})`,
    )
    .join('\n')
}

async function listTodayTasks(caller: Caller) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, title, category, completed, memo')
    .eq('user_id', caller.userId)
    .eq('istoday', true)
    .order('priority', { ascending: true })
    .order('createdat', { ascending: true })
  if (error) throw new Error(`오늘 할 일 조회 실패: ${error.message}`)
  if (!data || data.length === 0) return '오늘 할 일이 없습니다.'
  return data
    .map((t: { id: string; title: string; category: string; completed: boolean; memo: string | null }) => {
      const memo = t.memo ? ` / 메모: ${t.memo.replace(/\s+/g, ' ').slice(0, 60)}${t.memo.length > 60 ? '…' : ''}` : ''
      return `- ${t.completed ? '[완료] ' : ''}[${t.category}] ${t.title} (id: ${t.id})${memo}`
    })
    .join('\n')
}

async function updateTaskMemo(caller: Caller, args: { task_id?: string; memo?: string; mode?: string }) {
  const taskId = (args?.task_id ?? '').trim()
  const memo = (args?.memo ?? '').trim()
  if (!taskId) throw new Error('task_id 가 필요합니다.')
  if (!memo) throw new Error('memo 가 비어 있습니다.')
  if (memo.length > 20000) throw new Error('memo 가 너무 깁니다 (최대 20000자).')

  // 내 할 일인지 확인하면서 기존 메모 조회
  const { data: task, error: findError } = await supabase
    .from('tasks')
    .select('id, title, memo')
    .eq('user_id', caller.userId)
    .eq('id', taskId)
    .maybeSingle()
  if (findError) throw new Error(`할 일 조회 실패: ${findError.message}`)
  if (!task) throw new Error('해당 id 의 할 일을 찾을 수 없습니다.')

  const nextMemo = args?.mode === 'replace' || !task.memo ? memo : `${task.memo}\n\n${memo}`
  const { error } = await supabase.from('tasks').update({ memo: nextMemo }).eq('user_id', caller.userId).eq('id', taskId)
  if (error) throw new Error(`메모 수정 실패: ${error.message}`)
  return `'${task.title}' 메모를 ${args?.mode === 'replace' ? '교체' : '추가'}했습니다. (현재 ${nextMemo.length}자)`
}

async function callTool(caller: Caller, name: string, args: Record<string, unknown>): Promise<string> {
  if (!(await consume(caller, minuteBucket(), 1, TOOL_CALLS_PER_MINUTE))) {
    throw new Error(`요청이 너무 많습니다. 도구는 1분에 ${TOOL_CALLS_PER_MINUTE}번까지 쓸 수 있으니 잠시 후 다시 시도해 주세요.`)
  }

  switch (name) {
    case 'add_backlog_tasks':
      return await addBacklogTasks(caller, args as { tasks?: TaskInput[] })
    case 'list_backlog':
      return await listBacklog(caller, args as { limit?: number })
    case 'list_today_tasks':
      return await listTodayTasks(caller)
    case 'update_task_memo':
      return await updateTaskMemo(caller, args as { task_id?: string; memo?: string; mode?: string })
    case 'list_categories':
      return (await getCategoryNames(caller.userId)).join(', ')
    default:
      throw new Error(`알 수 없는 도구: ${name}`)
  }
}

type JsonRpcRequest = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> }

/** JSON-RPC 메시지 하나 처리. 알림(notification)이면 null 반환 */
async function handleMessage(caller: Caller, msg: JsonRpcRequest): Promise<Record<string, unknown> | null> {
  const isNotification = msg.id === undefined || msg.id === null
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: msg.id, result })
  const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } })

  if (isNotification) return null

  switch (msg.method) {
    case 'initialize': {
      const requested = String(msg.params?.protocolVersion ?? '')
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : SUPPORTED_PROTOCOL_VERSIONS[0]
      return ok({
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          '포실이(개인 할 일 앱)의 백로그에 할 일을 등록하는 서버입니다. 등록 전에 list_categories 로 카테고리를 확인하고, 필요하면 list_backlog 로 중복을 확인하세요.',
      })
    }
    case 'ping':
      return ok({})
    case 'tools/list':
      return ok({ tools: TOOLS })
    case 'tools/call': {
      const name = String(msg.params?.name ?? '')
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>
      try {
        const text = await callTool(caller, name, args)
        return ok({ content: [{ type: 'text', text }] })
      } catch (e) {
        // 도구 실행 오류는 isError 로 돌려줘서 Claude 가 원인을 보고 다시 시도할 수 있게 함
        return ok({ content: [{ type: 'text', text: (e as Error).message }], isError: true })
      }
    }
    default:
      return fail(-32601, `지원하지 않는 메서드: ${msg.method}`)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 연결 키 확인
  let caller: Caller | null
  try {
    caller = await resolveCaller(readKey(req))
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
  // 401 을 돌려주면 Claude 가 OAuth 로그인 절차를 시작하므로, 키 불일치는 403 으로 응답
  if (!caller) return json({ error: 'forbidden: 연결 키가 올바르지 않거나 폐기되었습니다.' }, 403)

  // 상태 없는 서버이므로 SSE 스트림(GET)은 제공하지 않음
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  let body: JsonRpcRequest | JsonRpcRequest[]
  try {
    body = await req.json()
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400)
  }

  const currentCaller = caller
  if (Array.isArray(body)) {
    const results = (await Promise.all(body.map((msg) => handleMessage(currentCaller, msg)))).filter((r) => r !== null)
    return results.length ? json(results) : new Response(null, { status: 202, headers: corsHeaders })
  }

  const result = await handleMessage(currentCaller, body)
  return result ? json(result) : new Response(null, { status: 202, headers: corsHeaders })
})
