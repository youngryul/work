// Supabase Edge Function: OpenAI 프록시
// 브라우저에 OpenAI API 키(VITE_OPENAI_API_KEY)를 노출하지 않기 위해, 모든 OpenAI 호출을 이 함수가 대신 보냅니다.
// - 인증: 로그인한 사용자의 Supabase access token (Authorization: Bearer <token>)
//   anon key 도 JWT 라서 게이트웨이를 통과하므로, 함수 안에서 auth.getUser 로 실제 사용자인지 다시 확인
// - 허용 경로: /v1/chat/completions, /v1/images/generations
// - 허용 모델 / 토큰 상한을 둬서 키가 다른 용도로 쓰이지 않게 제한
// - 필요한 시크릿: OPENAI_API_KEY (generate-image-huggingface 와 같은 키)
// - 배포: supabase functions deploy openai-proxy   (JWT 검증 켠 상태로 배포)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const ALLOWED_CHAT_MODELS = ['gpt-4o-mini']
const ALLOWED_IMAGE_MODELS = ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']
const MAX_CHAT_TOKENS = 4000
const MAX_BODY_BYTES = 8 * 1024 * 1024 // 음식 사진(base64) 고려

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '')

function corsHeaders(req: Request) {
  // OpenAI SDK 가 x-stainless-* 헤더를 붙이므로 요청한 헤더를 그대로 허용
  const requested = req.headers.get('Access-Control-Request-Headers')
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': requested || 'authorization, x-client-info, apikey, content-type',
  }
}

function errorResponse(req: Request, status: number, message: string) {
  // OpenAI 와 같은 에러 형태로 돌려줘서 기존 클라이언트 에러 처리가 그대로 동작하게 함
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return errorResponse(req, 405, 'Method Not Allowed')

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) return errorResponse(req, 500, 'OpenAI API 키가 설정되지 않았습니다.')

  // 로그인 사용자 확인
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) return errorResponse(req, 401, '로그인이 필요합니다.')

  // 경로 확인 (/functions/v1/openai-proxy/v1/... 또는 /openai-proxy/v1/...)
  const pathname = new URL(req.url).pathname
  const isChat = pathname.endsWith('/v1/chat/completions')
  const isImage = pathname.endsWith('/v1/images/generations')
  if (!isChat && !isImage) return errorResponse(req, 404, '허용되지 않은 경로입니다.')

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) return errorResponse(req, 413, '요청이 너무 큽니다.')

  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return errorResponse(req, 400, '잘못된 요청 형식입니다.')
  }

  const model = String(body.model ?? '')
  if (isChat) {
    if (!ALLOWED_CHAT_MODELS.includes(model)) return errorResponse(req, 400, `허용되지 않은 모델입니다: ${model}`)
    if (body.stream) return errorResponse(req, 400, '스트리밍은 지원하지 않습니다.')
    const maxTokens = Number(body.max_tokens ?? body.max_completion_tokens ?? MAX_CHAT_TOKENS)
    if (!Number.isFinite(maxTokens) || maxTokens > MAX_CHAT_TOKENS) body.max_tokens = MAX_CHAT_TOKENS
  } else {
    if (!ALLOWED_IMAGE_MODELS.includes(model)) return errorResponse(req, 400, `허용되지 않은 모델입니다: ${model}`)
    body.n = 1
  }

  const upstream = await fetch(`https://api.openai.com${isChat ? '/v1/chat/completions' : '/v1/images/generations'}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  // OpenAI 응답(성공/에러)을 그대로 전달
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { ...corsHeaders(req), 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  })
})
