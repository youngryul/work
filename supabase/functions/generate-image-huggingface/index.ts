// Supabase Edge Function: 일기 AI 이미지 생성 (OpenAI)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DIARY_IMAGE_MODEL = 'gpt-image-1'
const DIARY_IMAGE_SIZE = '1024x1024'
const DIARY_IMAGE_QUALITY = 'low'

const DIARY_IMAGE_PROMPT_SUFFIX =
  'Absolutely no text, no letters, no words, no numbers, no captions, no subtitles, no signs, no labels, no logos, no watermarks, no speech bubbles with writing, no typography, no readable symbols, no book pages with writing, no screens showing characters, purely visual illustration only.'

const DIARY_IMAGE_GPT_NO_TEXT_RULES = `- CRITICAL: The image must contain NO text, letters, words, numbers, captions, signs, labels, watermarks, logos, or typography in any language.
- Do NOT include speech bubbles, subtitles, newspapers, readable book pages, street signs, shop signs, phone screens with text, or UI elements with characters.
- Tell the story only through characters, objects, colors, and composition — never through written language.`

const STYLE_LOCK_BASE =
  'Consistent art style across panels: colorful crayon / colored-pencil illustration, thick black outlines, soft paper texture, vibrant but cohesive palette. Main character is always the same "Posili": a cute chubby round potato with a warm smile and tiny arms/legs, identical design in every panel.'

const GPT_SYSTEM_PROMPT = `You are an assistant that converts Korean diary entries into short English image generation prompts.
Rules:
- The main character is always "Posili", a cute chubby round potato character with a warm smile and tiny arms/legs.
- Style: colorful crayon drawing, thick black outlines, vibrant rich colors, multiple bright colors throughout the scene.
- Identify the dominant emotion in the diary and choose a matching main color (e.g. happy → bright yellow, sad → deep blue, excited → vivid orange-red, calm → sky blue, love → rose pink, etc.).
- Use that emotion color as the main color and add 3-4 complementary vivid crayon colors for objects and background details.
- Describe a single scene that captures the mood or key moment of the diary.
- Avoid defaulting to food, meals, restaurants, books, studying, desks, or libraries unless the diary EXPLICITLY centers on those.
- Prefer varied everyday situations grounded in the diary: outdoors, commute, conversation, weather, hobbies, work, rest, nature, chores, social moments, movement, etc.
- Keep the prompt under 130 words.
- Always start the prompt with the main color description and overall color palette.
${DIARY_IMAGE_GPT_NO_TEXT_RULES}
- Respond with valid JSON only: {"prompt":"...","emotion":"one English emotion word","scene":"brief English scene description"}
- The prompt field must describe a purely visual scene with zero readable text.`

const FOUR_CUT_PLAN_SYSTEM = `You plan a 4-panel photo-booth comic from a Korean diary.
Return JSON only:
{
  "emotion": "one English emotion word",
  "styleLock": "one English paragraph locking identical Posili design + crayon style + shared color palette for ALL panels",
  "panels": [
    { "beat": 1, "timeLabel": "morning|afternoon|evening|night", "summary": "one short English visual sentence", "setting": "place", "action": "what Posili is doing" },
    { "beat": 2, "timeLabel": "...", "summary": "...", "setting": "...", "action": "..." },
    { "beat": 3, "timeLabel": "...", "summary": "...", "setting": "...", "action": "..." },
    { "beat": 4, "timeLabel": "...", "summary": "...", "setting": "...", "action": "..." }
  ]
}
Rules:
- Read the diary carefully and compress it into exactly 4 chronological beats that show the flow of time (start → develop → peak/emotion → end).
- Each panel summary must be a distinct moment; do not repeat the same activity.
- Do NOT default to food, cooking, restaurants, books, studying, desks, libraries, or cafes unless the diary EXPLICITLY focuses on them.
- Prefer diverse settings and actions grounded in the diary: outdoors, transit, weather, conversation, hobbies, work, rest, nature, chores, social moments, movement, quiet reflection, etc.
- styleLock MUST include: Posili as the same cute chubby round potato character, crayon/colored-pencil look, thick black outlines, and a fixed emotion-based color palette so all panels look consistent.
- No text/letters/numbers in any panel description.
${DIARY_IMAGE_GPT_NO_TEXT_RULES}`

function finalizeDiaryImagePrompt(prompt: string): string {
  const trimmed = (prompt || '').trim()
  if (!trimmed) return DIARY_IMAGE_PROMPT_SUFFIX
  if (trimmed.toLowerCase().includes('no text')) return trimmed
  return `${trimmed}. ${DIARY_IMAGE_PROMPT_SUFFIX}`
}

async function buildPromptFromDiary(apiKey: string, diaryContent: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: GPT_SYSTEM_PROMPT },
        { role: 'user', content: diaryContent.substring(0, 500) },
      ],
      max_tokens: 220,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || '프롬프트 생성에 실패했습니다.')
  }

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content || '{}'
  let parsed: { prompt?: string; emotion?: string; scene?: string } = {}

  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = { prompt: raw }
  }

  return {
    prompt: finalizeDiaryImagePrompt(parsed.prompt || ''),
    emotion: parsed.emotion || null,
    scene: parsed.scene || null,
  }
}

async function planFourCut(apiKey: string, diaryContent: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: FOUR_CUT_PLAN_SYSTEM },
        { role: 'user', content: diaryContent.substring(0, 1200) },
      ],
      max_tokens: 700,
      temperature: 0.75,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error?.message || '4컷 요약 계획 생성에 실패했습니다.')
  }

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content || '{}'
  let parsed: {
    emotion?: string
    styleLock?: string
    panels?: Array<{
      beat?: number
      timeLabel?: string
      summary?: string
      setting?: string
      action?: string
    }>
  } = {}

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('4컷 요약 계획 JSON 파싱에 실패했습니다.')
  }

  const panels = Array.isArray(parsed.panels) ? parsed.panels.slice(0, 4) : []
  if (panels.length === 0) {
    throw new Error('4컷 요약 패널이 비어 있습니다.')
  }

  while (panels.length < 4) {
    const last = panels[panels.length - 1]
    panels.push({
      beat: panels.length + 1,
      timeLabel: last?.timeLabel || 'evening',
      summary: last?.summary || 'Posili quietly ends the day',
      setting: last?.setting || 'cozy room',
      action: last?.action || 'resting calmly',
    })
  }

  return {
    emotion: parsed.emotion || null,
    styleLock: (parsed.styleLock || STYLE_LOCK_BASE).trim(),
    panels: panels.map((panel, index) => ({
      beat: panel.beat || index + 1,
      timeLabel: panel.timeLabel || ['morning', 'afternoon', 'evening', 'night'][index],
      summary: panel.summary || `Beat ${index + 1} from the diary`,
      setting: panel.setting || 'everyday place',
      action: panel.action || 'Posili in a story moment',
    })),
  }
}

async function generateImage(apiKey: string, prompt: string) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DIARY_IMAGE_MODEL,
      prompt,
      size: DIARY_IMAGE_SIZE,
      quality: DIARY_IMAGE_QUALITY,
      n: 1,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.error?.message || errorData.error || response.statusText
    throw new Error(errorMessage)
  }

  const data = await response.json()
  const imageData = data.data?.[0]
  const imageUrl = imageData?.url
    ?? (imageData?.b64_json ? `data:image/png;base64,${imageData.b64_json}` : null)

  if (!imageUrl) {
    throw new Error('이미지 생성 실패: 응답 데이터가 올바르지 않습니다.')
  }

  return imageUrl
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const {
      action,
      diaryContent,
      imagePrompt,
    } = body || {}

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API 키가 설정되지 않았습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 4컷용: 일기 → 4줄 시간순 요약 계획
    if (action === 'plan_four_cut') {
      if (!diaryContent) {
        return new Response(
          JSON.stringify({ error: 'diaryContent가 필요합니다.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      const plan = await planFourCut(apiKey, diaryContent)
      return new Response(
        JSON.stringify(plan),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 사전 작성된 프롬프트로 바로 이미지 생성 (4컷 패널용)
    if (imagePrompt && typeof imagePrompt === 'string') {
      const prompt = finalizeDiaryImagePrompt(imagePrompt)
      const imageUrl = await generateImage(apiKey, prompt)
      return new Response(
        JSON.stringify({ imageUrl, prompt, emotion: null, scene: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!diaryContent) {
      return new Response(
        JSON.stringify({ error: 'diaryContent 또는 imagePrompt가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { prompt, emotion, scene } = await buildPromptFromDiary(apiKey, diaryContent)
    const imageUrl = await generateImage(apiKey, prompt)

    return new Response(
      JSON.stringify({ imageUrl, prompt, emotion, scene }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('generate-image-huggingface error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || '알 수 없는 오류' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
