import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
})

/**
 * GPT-4o로 일기 내용을 DALL-E 프롬프트로 변환
 * @param {string} content - 일기 내용
 * @returns {Promise<string>} 영문 이미지 프롬프트
 */
async function buildPromptFromDiary(content) {
  const systemPrompt = `You are an assistant that converts Korean diary entries into short English image generation prompts.
Rules:
- The main character is always "Posili", a cute chubby round potato character with a warm smile and tiny arms/legs.
- Style: colorful crayon drawing, warm pastel colors, childlike illustration, soft textures, cozy storybook feel.
- Describe a single scene that captures the mood or key moment of the diary.
- Keep the prompt under 120 words.
- Do NOT include any text or letters in the image.
- Output only the prompt, nothing else.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: content.substring(0, 500) },
    ],
    max_tokens: 150,
    temperature: 0.7,
  })

  return response.choices[0].message.content.trim()
}

/**
 * 일기 내용을 기반으로 AI 이미지 생성
 * @param {string} diaryContent - 일기 내용
 * @returns {Promise<{imageUrl: string, prompt: string}>}
 */
export async function generateDiaryImage(diaryContent) {
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.')
  }

  try {
    // 1단계: 일기 내용 → 이미지 프롬프트 변환
    const prompt = await buildPromptFromDiary(diaryContent)

    // 2단계: gpt-image-1으로 이미지 생성
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'low',
    })

    // gpt-image-1은 base64 반환, 기존 모델은 url 반환
    const imageData = response.data[0]
    const imageUrl = imageData.url
      ?? (imageData.b64_json ? `data:image/png;base64,${imageData.b64_json}` : null)

    if (!imageUrl) throw new Error('이미지 생성에 실패했습니다.')

    return { imageUrl, prompt }
  } catch (error) {
    console.error('이미지 생성 오류:', error)

    const msg = error.message || ''

    if (msg.includes('rate_limit') || msg.includes('Rate limit')) {
      throw new Error('API 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.')
    } else if (msg.includes('insufficient_quota') || msg.includes('quota') || msg.includes('billing')) {
      throw new Error('OpenAI API 크레딧이 부족합니다. OpenAI 대시보드에서 결제 정보를 확인해주세요.')
    } else if (msg.includes('invalid_api_key') || msg.includes('Invalid API key')) {
      throw new Error('OpenAI API 키가 유효하지 않습니다.')
    } else if (msg.includes('content_policy') || msg.includes('safety')) {
      throw new Error('이미지 생성 정책에 맞지 않는 내용이 포함되어 있습니다.')
    }

    throw new Error(`이미지 생성 실패: ${msg || '알 수 없는 오류'}`)
  }
}

/**
 * 프롬프트 미리보기 (디버깅용)
 */
export async function previewPrompt(content) {
  return await buildPromptFromDiary(content)
}
