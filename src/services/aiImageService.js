import OpenAI from 'openai'

/**
 * OpenAI 이미지 생성 서비스
 * 일기 내용을 기반으로 AI 이미지를 생성합니다.
 */

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // 브라우저에서 사용 (프로덕션에서는 서버 사이드로 이동 권장)
})

/**
 * 일기 내용을 이미지 생성 프롬프트로 변환
 * @param {string} content - 일기 내용
 * @returns {string} 이미지 생성 프롬프트
 */
function createImagePrompt(content) {
  // 일기 내용을 간단하고 시각적인 프롬프트로 변환
  // 이미지처럼 단순한 일러스트 스타일로 생성
  
  const baseStyle = "simple line drawing, minimalist, black and white, doodle style, hand-drawn sketch, clean lines, journal illustration"
  
  // 일기 내용의 핵심 키워드 추출 (간단한 예시)
  // 실제로는 더 정교한 키워드 추출 로직을 사용할 수 있습니다
  const keywords = content
    .substring(0, 200) // 처음 200자만 사용
    .replace(/[^\w\s가-힣]/g, ' ') // 특수문자 제거
    .split(/\s+/)
    .filter(word => word.length > 1)
    .slice(0, 10) // 상위 10개 키워드만 사용
    .join(', ')
  
  return `${keywords}, ${baseStyle}`
}

/**
 * 일기 내용을 기반으로 AI 이미지 생성
 * @param {string} diaryContent - 일기 내용
 * @returns {Promise<{imageUrl: string, prompt: string}>} 생성된 이미지 URL과 사용된 프롬프트
 */
export async function generateDiaryImage(diaryContent) {
  if (!import.meta.env.VITE_OPENAI_API_KEY) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다. .env 파일에 VITE_OPENAI_API_KEY를 추가해주세요.')
  }

  try {
    // 프롬프트 생성
    const prompt = createImagePrompt(diaryContent)
    
    // OpenAI DALL-E로 이미지 생성
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024', // 달력에 표시하기 적합한 크기
      quality: 'standard',
      style: 'natural', // 자연스러운 스타일
    })
    
    const imageUrl = response.data[0].url
    
    if (!imageUrl) {
      throw new Error('이미지 생성에 실패했습니다.')
    }
    
    return {
      imageUrl,
      prompt,
    }
  } catch (error) {
    console.error('이미지 생성 오류:', error)
    
    // 더 구체적인 에러 메시지 제공
    if (error.message?.includes('rate_limit')) {
      throw new Error('API 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.')
    } else if (error.message?.includes('insufficient_quota')) {
      throw new Error('OpenAI API 크레딧이 부족합니다.')
    } else if (error.message?.includes('invalid_api_key')) {
      throw new Error('OpenAI API 키가 유효하지 않습니다.')
    }
    
    throw new Error(`이미지 생성 실패: ${error.message || '알 수 없는 오류'}`)
  }
}

/**
 * 프롬프트 미리보기 (디버깅용)
 * @param {string} content - 일기 내용
 * @returns {string} 생성될 프롬프트
 */
export function previewPrompt(content) {
  return createImagePrompt(content)
}
