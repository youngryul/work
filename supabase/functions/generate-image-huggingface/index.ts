// Supabase Edge Function: OpenAI API를 사용하여 이미지 생성
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 이미지 생성 프롬프트 생성 상수
const DEFAULT_MODEL = "gpt-image-1"

// 고정 스타일 규칙 (연필 제외)
const FIXED_STYLE = "thick black outline, vibrant colorful crayon-like fill, rich saturated colors, multiple bright colors throughout, rainbow-like color variety, minimalist doodle style, hand-drawn sketch, journal illustration, white background, Posili cute chubby round potato character with tiny arms and legs and a warm smile, simple objects and scenes, bold colorful crayon texture, playful and cheerful, colorful details everywhere, no pencil, no writing tools, no pen, no stationery items"

// 감정 타입 정의 (더 세분화)
type Emotion = 
  | 'calm' | 'comfort' | 'happiness' | 'sadness' | 'anxiety' | 'loneliness' | 'hope' | 'tiredness'
  | 'excitement' | 'gratitude' | 'nostalgia' | 'frustration' | 'relief' | 'pride' | 'embarrassment'
  | 'envy' | 'determination' | 'confusion' | 'peace' | 'love' | 'anger' | 'disappointment' | 'satisfaction'

// 감정 키워드 매핑 (더 세분화)
const EMOTION_KEYWORDS: Record<Emotion, string[]> = {
  calm: ['평온', '차분', '고요', '평화', 'calm', 'peaceful', 'quiet', 'serene', 'tranquil', '조용', '안정'],
  comfort: ['위로', '안정', '편안', '따뜻', 'comfort', 'comfortable', 'cozy', 'warm', 'safe', '안락', '포근'],
  happiness: ['행복', '기쁨', '즐거움', '웃음', 'happiness', 'happy', 'joy', 'cheerful', 'delighted', '환희', '기쁨'],
  sadness: ['슬픔', '우울', '눈물', '아픔', 'sadness', 'sad', 'depressed', 'melancholy', 'gloomy', '비애', '서글픔'],
  anxiety: ['불안', '걱정', '초조', '두려움', 'anxiety', 'anxious', 'worried', 'nervous', 'fear', '불안감', '조마조마'],
  loneliness: ['외로움', '고독', '혼자', '쓸쓸', 'loneliness', 'lonely', 'alone', 'isolated', 'empty', '고립', '단절'],
  hope: ['희망', '기대', '밝음', '미래', 'hope', 'hopeful', 'optimistic', 'bright', 'future', '기대감', '밝은'],
  tiredness: ['지침', '피곤', '힘듦', '무기력', 'tiredness', 'tired', 'exhausted', 'weary', 'drained', '지루', '권태'],
  excitement: ['흥분', '설렘', '두근거림', '떨림', 'excitement', 'excited', 'thrilled', 'enthusiastic', 'eager', '흥미진진'],
  gratitude: ['감사', '고마움', '감사함', '고마워', 'gratitude', 'grateful', 'thankful', 'appreciative', 'thanks', '감사한'],
  nostalgia: ['그리움', '향수', '추억', '회상', 'nostalgia', 'nostalgic', 'homesick', 'longing', 'yearning', '그리워'],
  frustration: ['답답', '좌절', '짜증', '불만', 'frustration', 'frustrated', 'annoyed', 'irritated', 'stuck', '막힘'],
  relief: ['안도', '다행', '해소', '편안', 'relief', 'relieved', 'eased', 'comforted', 'peaceful', '안심'],
  pride: ['자랑', '뿌듯', '자신감', '만족', 'pride', 'proud', 'confident', 'accomplished', 'achievement', '성취'],
  embarrassment: ['부끄러움', '당황', '창피', '민망', 'embarrassment', 'embarrassed', 'ashamed', 'awkward', 'uncomfortable', '어색'],
  envy: ['부러움', '질투', '선망', 'envy', 'envious', 'jealous', 'covetous', 'desire', '탐내'],
  determination: ['의지', '결심', '의욕', '투지', 'determination', 'determined', 'resolved', 'motivated', 'persistent', '의지력'],
  confusion: ['혼란', '당황', '어리둥절', '헷갈림', 'confusion', 'confused', 'bewildered', 'puzzled', 'uncertain', '막막'],
  peace: ['평화', '고요', '안정', '평온', 'peace', 'peaceful', 'serene', 'calm', 'tranquil', '조화'],
  love: ['사랑', '애정', '좋아함', '애착', 'love', 'loving', 'affectionate', 'fond', 'caring', '따뜻한'],
  anger: ['화', '분노', '짜증', '성', 'anger', 'angry', 'mad', 'furious', 'irritated', '화남'],
  disappointment: ['실망', '아쉬움', '낙담', '절망', 'disappointment', 'disappointed', 'let down', 'discouraged', 'disheartened', '좌절'],
  satisfaction: ['만족', '보람', '성취감', '기쁨', 'satisfaction', 'satisfied', 'content', 'fulfilled', 'pleased', '충족']
}

// 감정 → 색감 매핑 (메인 색상 + 알록달록한 크레파스 조합)
const EMOTION_ATMOSPHERE: Record<Emotion, string> = {
  calm: 'main color sky blue, accented with soft mint green and pale lavender and warm cream, gentle pastel rainbow palette, serene and tranquil mood',
  comfort: 'main color warm golden yellow, accented with soft orange and peachy pink and light green, cozy crayon rainbow palette, homey and cheerful mood',
  happiness: 'main color bright sunny yellow, bursting with vibrant red and electric blue and hot pink and lime green, full rainbow crayon palette, joyful and energetic mood',
  sadness: 'main color deep cornflower blue, accented with soft violet and muted teal and pale silver, cool melancholic palette with subtle color pops, contemplative mood',
  anxiety: 'main color cool gray-blue, accented with muted yellow and pale orange and soft red, tense crayon palette with scattered color accents, uncertain mood',
  loneliness: 'main color dusty blue, accented with soft lavender and pale mint and muted silver, quiet and spacious color palette, isolated and reflective mood',
  hope: 'main color bright coral pink, bursting with warm golden yellow and sky blue and light green and white, sunrise crayon rainbow palette, optimistic and uplifting mood',
  tiredness: 'main color soft lilac purple, accented with dusty blue and warm beige and muted peach, sleepy pastel crayon palette, weary but peaceful mood',
  excitement: 'main color vivid orange-red, bursting with electric yellow and hot pink and bright purple and neon green, dynamic rainbow crayon palette, thrilling and energetic mood',
  gratitude: 'main color warm amber gold, accented with burnt orange and rosy pink and soft green and cream, glowing grateful crayon palette, heartfelt and warm mood',
  nostalgia: 'main color warm sepia brown, accented with dusty rose and faded yellow and soft teal and vintage cream, retro crayon palette, sentimental and dreamy mood',
  frustration: 'main color fiery red-orange, accented with sharp yellow and dark brown and electric blue, clashing energetic crayon palette, tense and stuck mood',
  relief: 'main color fresh mint green, accented with sky blue and soft yellow and pale peach and white, light breezy crayon palette, relaxed and unburdened mood',
  pride: 'main color royal purple, accented with bold gold and vivid crimson and bright blue and silver, triumphant rich crayon palette, confident and accomplished mood',
  embarrassment: 'main color rosy pink, accented with soft coral and warm peach and light lavender and blush white, gentle flustered crayon palette, shy and self-conscious mood',
  envy: 'main color emerald green, accented with golden yellow and deep teal and muted red and dark olive, longing crayon palette, bittersweet and covetous mood',
  determination: 'main color bold crimson red, accented with strong orange and deep navy and bright white and sharp yellow, intense focused crayon palette, driven and motivated mood',
  confusion: 'main color swirling gray-violet, accented with mismatched teal and orange and yellow and pink, chaotic mixed crayon palette, puzzled and bewildered mood',
  peace: 'main color soft white-blue, accented with pale green and gentle lavender and warm ivory and sky blue, harmonious balanced crayon palette, serene and unified mood',
  love: 'main color vivid rose pink, accented with warm red and soft coral and light gold and gentle lavender, affectionate glowing crayon palette, tender and loving mood',
  anger: 'main color intense fiery red, accented with dark burnt orange and sharp black and bold yellow and deep maroon, fierce heated crayon palette, furious and passionate mood',
  disappointment: 'main color muted slate blue, accented with gray and faded olive and dull rose and soft brown, subdued dejected crayon palette, discouraged and downhearted mood',
  satisfaction: 'main color warm olive green, accented with golden yellow and soft orange and cream and light teal, content fulfilled crayon palette, peaceful and accomplished mood'
}

/**
 * 일기 내용에서 감정 분석
 * @param {string} content - 일기 내용
 * @returns {Emotion} 감정
 */
function analyzeEmotion(content: string): Emotion {
  const lowerContent = content.toLowerCase()
  let emotionScores: Record<Emotion, number> = {
    calm: 0,
    comfort: 0,
    happiness: 0,
    sadness: 0,
    anxiety: 0,
    loneliness: 0,
    hope: 0,
    tiredness: 0,
    excitement: 0,
    gratitude: 0,
    nostalgia: 0,
    frustration: 0,
    relief: 0,
    pride: 0,
    embarrassment: 0,
    envy: 0,
    determination: 0,
    confusion: 0,
    peace: 0,
    love: 0,
    anger: 0,
    disappointment: 0,
    satisfaction: 0
  }

  // 각 감정의 키워드 매칭
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        emotionScores[emotion as Emotion]++
      }
    }
  }

  // 가장 높은 점수의 감정 반환 (동점일 경우 기본값: calm)
  let maxScore = 0
  let detectedEmotion: Emotion = 'calm'
  
  for (const [emotion, score] of Object.entries(emotionScores)) {
    if (score > maxScore) {
      maxScore = score
      detectedEmotion = emotion as Emotion
    }
  }

  // 점수가 모두 0이면 기본값 calm 반환
  return maxScore > 0 ? detectedEmotion : 'calm'
}

/**
 * OpenAI GPT를 사용하여 일기 내용 요약
 * @param {string} content - 일기 내용
 * @param {string} apiKey - OpenAI API 키
 * @returns {Promise<string>} 요약된 장면 설명
 */
async function summarizeDiaryContent(content: string, apiKey: string): Promise<string> {
  try {
    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that summarizes diary entries into short, simple scene descriptions for image generation. Focus on the main activities, objects, and atmosphere. Keep it under 20 words. Do not include people or characters, only describe scenes and objects. Do not include pencils, pens, writing tools, or stationery items. Output only the summary in English, no additional text.'
            },
            {
              role: 'user',
              content: `Summarize this diary entry into a simple scene description for image generation: ${content.substring(0, 1000)}`
            }
          ],
          max_tokens: 50,
          temperature: 0.7,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('일기 요약 실패:', errorData)
      // 실패 시 기본값 반환
      return 'Posili a cute chubby potato character in a simple scene'
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content?.trim()

    if (!summary) {
      return 'Posili a cute chubby potato character in a simple scene'
    }

    // 요약된 내용을 장면 설명으로 변환
    return `Posili a cute chubby potato character with ${summary.toLowerCase()}`
  } catch (error) {
    console.error('일기 요약 오류:', error)
    // 오류 시 기본값 반환
    return 'Posili a cute chubby potato character in a simple scene'
  }
}

/**
 * 일기 내용을 이미지 생성 프롬프트로 변환
 * @param {string} content - 일기 내용
 * @param {string} apiKey - OpenAI API 키
 * @returns {Promise<{emotion: Emotion, scene: string, prompt: string}>} 감정, 장면, 프롬프트
 */
async function createImagePrompt(content: string, apiKey: string): Promise<{ emotion: Emotion, scene: string, prompt: string }> {
  const emotion = analyzeEmotion(content)
  const scene = await summarizeDiaryContent(content, apiKey)
  const colors = EMOTION_ATMOSPHERE[emotion]

  // 프롬프트를 더 간결하고 안전하게 구성 (포실이 포함, 크레파스 느낌, 연필 제외)
  const prompt = `Colorful crayon-style illustration, ${colors}, ${scene}, thick black outline, vibrant hand-drawn doodle, ${FIXED_STYLE}, rich colorful details, absolutely no pencil, no pen, no writing tools, no stationery, no office supplies`

  return {
    emotion,
    scene,
    prompt
  }
}

serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { diaryContent, model } = await req.json()

    if (!diaryContent) {
      return new Response(
        JSON.stringify({ error: 'diaryContent가 필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // OpenAI API 키 확인
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API 키가 설정되지 않았습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 프롬프트 생성 (감정 분석 및 AI 요약 포함)
    const { emotion, scene, prompt } = await createImagePrompt(diaryContent, apiKey)
    
    // 사용할 모델 결정
    const modelName = model || DEFAULT_MODEL
    
    // OpenAI Images API 호출
    const response = await fetch(
      'https://api.openai.com/v1/images/generations',
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          model: modelName,
          prompt: prompt,
          size: '1024x1024',
          quality: 'low',
          n: 1,
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage = errorData.error?.message || errorData.error || response.statusText
      
      // 특정 오류 메시지 처리
      if (errorMessage.includes('rate_limit') || errorMessage.includes('Rate limit')) {
        return new Response(
          JSON.stringify({ error: 'API 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else if (errorMessage.includes('quota') || errorMessage.includes('Quota') || errorMessage.includes('insufficient_quota')) {
        return new Response(
          JSON.stringify({ error: 'API 할당량을 초과했습니다. OpenAI 대시보드에서 할당량을 확인해주세요.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else if (errorMessage.includes('invalid_api_key') || errorMessage.includes('Invalid API key')) {
        return new Response(
          JSON.stringify({ error: 'OpenAI API 키가 유효하지 않습니다.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else if (errorMessage.includes('does not have access to model') || errorMessage.includes('must be verified')) {
        return new Response(
          JSON.stringify({ error: `모델 '${modelName}'에 대한 접근 권한이 없습니다. OpenAI 대시보드(https://platform.openai.com/settings/organization)에서 모델 접근 권한을 확인하거나, DALL-E 3 모델을 사용해주세요.` }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } else if (errorMessage.includes('safety system') || errorMessage.includes('rejected') || errorMessage.includes('not allowed')) {
        return new Response(
          JSON.stringify({ error: '프롬프트가 안전 정책에 위배됩니다. 일기 내용을 수정하거나 다른 내용으로 다시 시도해주세요.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ error: `이미지 생성 실패: ${errorMessage}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()

    if (!data.data || !data.data[0]) {
      return new Response(
        JSON.stringify({ error: '이미지 생성 실패: 응답 데이터가 올바르지 않습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // gpt-image-1은 b64_json 반환, 기존 모델은 url 반환
    const imageData = data.data[0]
    const imageUrl = imageData.url
      ?? (imageData.b64_json ? `data:image/png;base64,${imageData.b64_json}` : null)

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: '이미지 생성 실패: 이미지 데이터를 찾을 수 없습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        imageUrl: imageUrl,
        prompt: prompt,
        emotion: emotion,
        scene: scene
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('에러:', error)
    return new Response(
      JSON.stringify({ error: error.message || '알 수 없는 오류' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

