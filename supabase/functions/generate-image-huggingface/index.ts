// Supabase Edge Function: 일기 AI 이미지 생성 (OpenAI DALL-E)
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

const GPT_SYSTEM_PROMPT = `You are an assistant that converts Korean diary entries into short English image generation prompts.
Rules:
- The main character is always "Posili", a cute chubby round potato character with a warm smile and tiny arms/legs.
- Style: colorful crayon drawing, thick black outlines, vibrant rich colors, multiple bright colors throughout the scene.
- Identify the dominant emotion in the diary and choose a matching main color (e.g. happy → bright yellow, sad → deep blue, excited → vivid orange-red, calm → sky blue, love → rose pink, etc.).
- Use that emotion color as the main color and add 3-4 complementary vivid crayon colors for objects and background details.
- Describe a single scene that captures the mood or key moment of the diary.
- Keep the prompt under 130 words.
- Always start the prompt with the main color description and overall color palette.
${DIARY_IMAGE_GPT_NO_TEXT_RULES}
- Respond with valid JSON only: {"prompt":"...","emotion":"one English emotion word","scene":"brief English scene description"}
- The prompt field must describe a purely visual scene with zero readable text.`

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
    const { diaryContent } = await req.json()

    if (!diaryContent) {
      return new Response(
        JSON.stringify({ error: 'diaryContent가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API 키가 설정되지 않았습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
