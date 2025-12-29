// Supabase Edge Function: OpenAI API를 사용하여 이미지 생성
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 이미지 생성 프롬프트 생성 상수
const DEFAULT_MODEL = "dall-e-3"

// 고정 스타일 규칙
const FIXED_STYLE = "simple black line art, colorful crayon-like fill, minimalist doodle style, clean lines, hand-drawn sketch, journal illustration, white background, cute bear character, adorable teddy bear, simple objects and scenes, bright colorful crayon-like texture, playful and cheerful"

// 감정 타입 정의
type Emotion = 'calm' | 'comfort' | 'happiness' | 'sadness' | 'anxiety' | 'loneliness' | 'hope' | 'tiredness'

// 감정 키워드 매핑
const EMOTION_KEYWORDS: Record<Emotion, string[]> = {
  calm: ['평온', '차분', '고요', '평화', 'calm', 'peaceful', 'quiet', 'serene', 'tranquil'],
  comfort: ['위로', '안정', '편안', '따뜻', 'comfort', 'comfortable', 'cozy', 'warm', 'safe'],
  happiness: ['행복', '기쁨', '즐거움', '웃음', 'happiness', 'happy', 'joy', 'cheerful', 'delighted'],
  sadness: ['슬픔', '우울', '눈물', '아픔', 'sadness', 'sad', 'depressed', 'melancholy', 'gloomy'],
  anxiety: ['불안', '걱정', '초조', '두려움', 'anxiety', 'anxious', 'worried', 'nervous', 'fear'],
  loneliness: ['외로움', '고독', '혼자', '쓸쓸', 'loneliness', 'lonely', 'alone', 'isolated', 'empty'],
  hope: ['희망', '기대', '밝음', '미래', 'hope', 'hopeful', 'optimistic', 'bright', 'future'],
  tiredness: ['지침', '피곤', '힘듦', '무기력', 'tiredness', 'tired', 'exhausted', 'weary', 'drained']
}

// 감정 → 색감 매핑 (알록달록한 크레파스 느낌)
const EMOTION_ATMOSPHERE: Record<Emotion, string> = {
  calm: 'soft pastel colors, gentle beige and light blue, peaceful and calm',
  comfort: 'warm yellow and orange, cozy and inviting, bright and cheerful',
  happiness: 'vibrant rainbow colors, bright and colorful, joyful and playful',
  sadness: 'cool blue and purple tones, gentle and soft, melancholic but beautiful',
  anxiety: 'muted pastels with hints of color, soft and gentle',
  loneliness: 'cool blue and gray tones, spacious and quiet, peaceful',
  hope: 'bright yellow and pink, warm and optimistic, cheerful sunrise colors',
  tiredness: 'soft warm colors, gentle purple and blue, restful and calm'
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
    tiredness: 0
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
              content: 'You are a helpful assistant that summarizes diary entries into short, simple scene descriptions for image generation. Focus on the main activities, objects, and atmosphere. Keep it under 20 words. Do not include people or characters, only describe scenes and objects. Output only the summary in English, no additional text.'
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
      return 'a cute bear in a simple scene'
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content?.trim()
    
    if (!summary) {
      return 'a cute bear in a simple scene'
    }

    // 요약된 내용을 장면 설명으로 변환
    return `a cute bear with ${summary.toLowerCase()}`
  } catch (error) {
    console.error('일기 요약 오류:', error)
    // 오류 시 기본값 반환
    return 'a cute bear in a simple scene'
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

  // 프롬프트를 더 간결하고 안전하게 구성 (귀여운 곰돌이 포함, 크레파스 느낌)
  const prompt = `Simple black line art illustration with colorful crayon-like fill, ${scene}, ${colors}, minimalistic doodle style, clean lines, white background, cute adorable bear character, ${FIXED_STYLE}`

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
          quality: 'hd',
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
    
    // OpenAI는 URL을 반환하므로 이미지 다운로드
    if (!data.data || !data.data[0] || !data.data[0].url) {
      return new Response(
        JSON.stringify({ error: '이미지 생성 실패: 응답 데이터가 올바르지 않습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const imageUrl = data.data[0].url
    
    // OpenAI가 반환한 URL을 그대로 사용 (임시 URL이므로 나중에 Supabase Storage에 업로드 필요)
    // 또는 Base64로 변환하려면 추가 다운로드 필요

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

