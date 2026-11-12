// Supabase Edge Function: 일기 AI 이미지 생성 (OpenAI)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// GPT Image 2.5 Flare (빠른 일상 생성용). 편집 정밀도가 더 필요하면 'gpt-image-2.5-sunburst'
const DIARY_IMAGE_MODEL = 'gpt-image-2.5-flare'
const DIARY_IMAGE_SIZE = '1024x1024'
const DIARY_IMAGE_QUALITY = 'low'

const DIARY_IMAGE_PROMPT_SUFFIX =
  'Absolutely no text, no letters, no words, no numbers, no captions, no subtitles, no signs, no labels, no logos, no watermarks, no speech bubbles with writing, no typography, no readable symbols, no book pages with writing, no screens showing characters, purely visual illustration only.'

const DIARY_IMAGE_GPT_NO_TEXT_RULES = `- CRITICAL: The image must contain NO text, letters, words, numbers, captions, signs, labels, watermarks, logos, or typography in any language.
- Do NOT include speech bubbles, subtitles, newspapers, readable book pages, street signs, shop signs, phone screens with text, or UI elements with characters.
- Tell the story only through characters, objects, colors, and composition — never through written language.`

// 포실이 실제 디자인(public/images/포실이.png) 기준 캐릭터 시트.
// 이미지 모델은 "Posili"라는 이름을 모르기 때문에 외형을 구체적으로 적지 않으면 모델이 바뀔 때마다 다른 캐릭터를 그린다.
// 클라이언트(웹/iOS)가 보낸 프롬프트와 상관없이 서버에서 항상 앞에 붙여 디자인을 고정한다.
const POSILI_CHARACTER_SHEET =
  'MAIN CHARACTER "Posili" (must match exactly in every image): a small cute potato blob shaped like a gumdrop or rice ball — rounded top, slightly wider soft bottom. ' +
  'Skin is warm golden-ochre / mustard-yellow with a subtle paper grain and a few small darker brown oval speckles. ' +
  'NO arms, NO hands, NO legs — only two tiny stubby rounded feet nubs peeking out at the very bottom. ' +
  'Face in the upper part of the body: two small solid black dot eyes each with one tiny white highlight, round soft pink blush cheeks just below the eyes, and a tiny pursed kissy mouth drawn as a small "3"-like squiggle between the eyes. ' +
  'No nose, no hair, no eyebrows, no teeth, no big open-mouth grin. Simple kawaii doodle drawn with a dark brown-black hand-drawn outline. ' +
  'Posili is NOT a human, NOT an animal, NOT a realistic potato, and never has long limbs. Keep the same size, proportions, colors and face in every image; only pose, tilt and small props may change.'

const STYLE_LOCK_BASE =
  'Consistent art style across panels: colorful crayon / colored-pencil illustration, thick black outlines, soft paper texture, vibrant but cohesive palette. Main character is always the same "Posili" (golden-ochre gumdrop-shaped potato blob, black dot eyes, pink blush cheeks, tiny kissy mouth, no arms or legs, two tiny feet nubs), identical design in every panel.'

/** 최종 이미지 프롬프트 앞에 포실이 캐릭터 시트를 붙인다 (중복 방지) */
function withPosiliCharacter(prompt: string): string {
  if (prompt.includes('MAIN CHARACTER "Posili"')) return prompt
  return `${POSILI_CHARACTER_SHEET} ${prompt}`
}

const GPT_SYSTEM_PROMPT = `You are an assistant that converts Korean diary entries into short English image generation prompts.
Rules:
- The main character is always "Posili": a small golden-ochre gumdrop-shaped potato blob with black dot eyes, pink blush cheeks, a tiny pursed kissy mouth, NO arms or legs (only two tiny feet nubs). Do not redesign it (no arms, no toothy smile, no clothes by default).
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

// 4컷 요약 계획 프롬프트
// - 기승전결(setup → development → climax → resolution) 역할을 컷마다 명시해 흐름이 한눈에 보이게 한다.
// - 컷마다 카메라 구도·포실이 몸짓·표정·움직임 효과를 따로 적게 해 장면을 구체적이고 역동적으로 만든다.
// - 포실이 외형은 이미지 생성 시 POSILI_CHARACTER_SHEET가 항상 앞에 붙으므로 여기서는 재디자인 금지만 강조한다.
const FOUR_CUT_PLAN_SYSTEM = `You are a storyboard artist planning a 4-panel photo-booth comic strip from a Korean diary.
The reader must be able to follow the day's story just by looking at the 4 pictures in order, with no words.

STEP 1 — Understand the diary (think silently, do not output):
- List the concrete events in time order: where the writer was, what happened, who/what was involved, how the feeling changed.
- Find the single most important moment or emotional turning point of the day.
- Keep real details from the diary (specific places, weather, objects, people, animals, activities). Never replace them with generic ones.

STEP 2 — Compress into exactly 4 beats with a clear story arc (기승전결):
- Panel 1 "setup" (기): where/when the day starts and the situation that kicks off the story.
- Panel 2 "development" (승): the event unfolds or a complication/new element appears. Must visibly move forward from panel 1.
- Panel 3 "climax" (전): the peak — the most important, surprising, funny, touching or frustrating moment. Strongest emotion and most dynamic image of the strip.
- Panel 4 "resolution" (결): the outcome and how Posili feels about the day — a satisfying ending that answers panel 1.
- If the diary covers only one event, split that event into 4 consecutive moments (before → during → peak → after) instead of inventing unrelated scenes.
- If the diary has more than 4 events, merge minor ones and keep the 4 that best tell the story.
- Each panel must show a different moment; change at least two of: location, time, camera shot, Posili's pose, key props.
- Link panels with a visual thread (a recurring object, weather, companion or color) so they read as one continuous story.

STEP 3 — Make every panel specific and dynamic:
- "summary": one vivid English sentence describing exactly what is happening in the frame, with concrete nouns (not "a fun moment" but "Posili bounces through a puddle as rain pours from dark clouds").
- "setting": a concrete location with 2-3 specific background details from the diary + time-of-day lighting (e.g. "crowded subway car at 8am, hanging straps swaying, morning sun through windows").
- "action": a verb-driven, in-motion action — mid-jump, sprinting, tumbling, spinning, leaning forward, squishing, stretching tall, bouncing, sliding, hiding, peeking, startled hop, collapsing flat. Avoid static "standing/sitting/looking" unless the moment truly calls for stillness (then make it expressive, e.g. "melting flat on the sofa in exhaustion").
- "posiliPose": body language of the blob — tilt angle, squash-and-stretch, which way it faces, feet nubs off the ground or planted, etc.
- "expression": Posili's face using ONLY its existing features (dot eyes can become sparkly, teary, wide, squeezed shut or swirly; blush can deepen; kissy mouth can wobble, pout or puff). Do not add teeth or a big open grin.
- "camera": shot type and angle chosen for storytelling and variety — e.g. wide establishing shot, medium shot, close-up, low angle, high angle, over-the-shoulder, dutch tilt. Use at least 3 different camera choices across the 4 panels; panel 1 is usually wide, panel 3 is usually a close-up or dramatic angle.
- "props": 1-3 key objects or companions in the scene that carry the story (from the diary).
- "motionCues": visual energy cues drawn in crayon — speed lines, motion trails, dust puffs, sweat drops, sparkles, little hearts, impact stars, wind swirls, raindrops, floating music notes, steam puffs. Panel 3 should have the strongest cues; a calm ending may use soft cues.
- "mood": the emotion of this panel in 1-3 English words and how the lighting/colors express it.

Return JSON only:
{
  "emotion": "exactly one of: happiness, excitement, love, gratitude, pride, satisfaction, hope, calm, peace, comfort, relief, determination, nostalgia, embarrassment, envy, confusion, anxiety, tiredness, loneliness, sadness, disappointment, frustration, anger",
  "storyline": "one English sentence summarizing the whole 4-panel story arc",
  "styleLock": "one English paragraph locking identical Posili design + crayon style + shared color palette for ALL panels",
  "panels": [
    { "beat": 1, "role": "setup", "timeLabel": "morning|afternoon|evening|night", "summary": "...", "setting": "...", "action": "...", "posiliPose": "...", "expression": "...", "camera": "...", "props": "...", "motionCues": "...", "mood": "..." },
    { "beat": 2, "role": "development", "timeLabel": "...", "summary": "...", "setting": "...", "action": "...", "posiliPose": "...", "expression": "...", "camera": "...", "props": "...", "motionCues": "...", "mood": "..." },
    { "beat": 3, "role": "climax", "timeLabel": "...", "summary": "...", "setting": "...", "action": "...", "posiliPose": "...", "expression": "...", "camera": "...", "props": "...", "motionCues": "...", "mood": "..." },
    { "beat": 4, "role": "resolution", "timeLabel": "...", "summary": "...", "setting": "...", "action": "...", "posiliPose": "...", "expression": "...", "camera": "...", "props": "...", "motionCues": "...", "mood": "..." }
  ]
}

Rules:
- Posili has no arms or hands: express actions through whole-body movement, position, nearby props and expression (e.g. bouncing beside an umbrella, peeking out of a bag, pushing a ball with its body, riding on a skateboard) instead of holding or grabbing.
- Never redesign Posili: no arms, no hands, no legs beyond the two tiny feet nubs, no clothes by default, no teeth or toothy grin. Small accessories (hat, scarf) only if the diary clearly suggests them.
- Other people or animals from the diary may appear as simple crayon side characters, but Posili is always the clear focal point of every panel.
- Do NOT default to food, cooking, restaurants, books, studying, desks, libraries, or cafes unless the diary EXPLICITLY focuses on them.
- styleLock MUST include: Posili as the same golden-ochre gumdrop-shaped potato blob (black dot eyes, pink blush cheeks, tiny kissy mouth, NO arms or legs, two tiny feet nubs), crayon/colored-pencil look, thick black outlines, and a fixed emotion-based color palette so all panels look consistent.
- Write every field in English. No text/letters/numbers in any panel description.
${DIARY_IMAGE_GPT_NO_TEXT_RULES}`

/** 4컷 패널 역할 (기승전결) */
const FOUR_CUT_ROLES = ['setup', 'development', 'climax', 'resolution']

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
        { role: 'user', content: diaryContent.substring(0, 2000) },
      ],
      // 패널 필드가 늘어나 응답이 길어지므로 토큰 여유를 늘린다
      max_tokens: 1600,
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
    storyline?: string
    styleLock?: string
    panels?: Array<{
      beat?: number
      role?: string
      timeLabel?: string
      summary?: string
      setting?: string
      action?: string
      posiliPose?: string
      expression?: string
      camera?: string
      props?: string
      motionCues?: string
      mood?: string
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
    storyline: parsed.storyline || null,
    styleLock: (parsed.styleLock || STYLE_LOCK_BASE).trim(),
    panels: panels.map((panel, index) => ({
      beat: panel.beat || index + 1,
      role: panel.role || FOUR_CUT_ROLES[index],
      timeLabel: panel.timeLabel || ['morning', 'afternoon', 'evening', 'night'][index],
      summary: panel.summary || `Beat ${index + 1} from the diary`,
      setting: panel.setting || 'everyday place',
      action: panel.action || 'Posili in a story moment',
      // 아래 필드는 선택값 — 기존 클라이언트(iOS 등)는 무시해도 동작한다
      posiliPose: panel.posiliPose || null,
      expression: panel.expression || null,
      camera: panel.camera || null,
      props: panel.props || null,
      motionCues: panel.motionCues || null,
      mood: panel.mood || null,
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
      prompt: withPosiliCharacter(prompt),
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
