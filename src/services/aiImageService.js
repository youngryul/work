import OpenAI from 'openai'
import { useCredits, checkSufficientCredits } from './creditService.js'
import { checkFeatureAccess } from './premiumFeatureService.js'
import { CREDIT_COSTS, PREMIUM_FEATURES } from '../constants/paymentConstants.js'

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
    // 프리미엄 기능 접근 확인 (구독 또는 잠금 해제)
    const hasPremiumAccess = await checkFeatureAccess(PREMIUM_FEATURES.AI_IMAGE)
    
    // 프리미엄 접근이 없으면 크레딧 확인 및 차감
    if (!hasPremiumAccess) {
      const requiredCredits = CREDIT_COSTS.AI_IMAGE_GENERATION
      const hasCredits = await checkSufficientCredits(requiredCredits)
      
      if (!hasCredits) {
        throw new Error('크레딧이 부족합니다. 크레딧을 충전해주세요.')
      }
    }

    // 프롬프트 생성
    const prompt = createImagePrompt(diaryContent)
    
    // OpenAI DALL-E로 이미지 생성
    const response = await openai.images.generate({
      model: 'dall-e-2', // DALL-E 2 사용 (비용 절감: $0.02 per image)
      prompt: prompt,
      n: 1,
      size: '1024x1024', // 달력에 표시하기 적합한 크기
      // DALL-E 2는 quality와 style 옵션을 지원하지 않음
    })
    
    const imageUrl = response.data[0].url
    
    if (!imageUrl) {
      throw new Error('이미지 생성에 실패했습니다.')
    }

    // 성공 시 크레딧 차감 (프리미엄 접근이 없는 경우만)
    if (!hasPremiumAccess) {
      try {
        await useCredits(CREDIT_COSTS.AI_IMAGE_GENERATION, 'AI 이미지 생성')
      } catch (creditError) {
        console.warn('크레딧 차감 실패 (이미지는 생성됨):', creditError)
        // 크레딧 차감 실패는 경고만 하고 계속 진행
      }
    }
    
    return {
      imageUrl,
      prompt,
    }
  } catch (error) {
    console.error('이미지 생성 오류:', error)
    console.error('오류 상세:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type
    })
    
    // 더 구체적인 에러 메시지 제공
    const errorMessage = error.message || error.toString() || ''
    
    if (errorMessage.includes('rate_limit') || errorMessage.includes('Rate limit')) {
      throw new Error('API 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.')
    } else if (errorMessage.includes('insufficient_quota') || errorMessage.includes('quota')) {
      throw new Error('OpenAI API 크레딧이 부족합니다. OpenAI 대시보드에서 결제 정보를 확인해주세요.')
    } else if (errorMessage.includes('Billing hard limit') || errorMessage.includes('billing')) {
      throw new Error('OpenAI API 결제 한도에 도달했습니다. OpenAI 대시보드(https://platform.openai.com/account/billing)에서 결제 한도를 늘리거나 결제 정보를 확인해주세요.')
    } else if (errorMessage.includes('invalid_api_key') || errorMessage.includes('Invalid API key')) {
      throw new Error('OpenAI API 키가 유효하지 않습니다. .env 파일의 VITE_OPENAI_API_KEY를 확인해주세요.')
    } else if (errorMessage.includes('does not have access to model') || errorMessage.includes('403')) {
      // DALL-E 모델 접근 권한 오류 (DALL-E 2 또는 DALL-E 3)
      const modelName = errorMessage.includes('dall-e-3') ? 'DALL-E 3' : 'DALL-E 2'
      throw new Error(`${modelName} 모델에 대한 접근 권한이 없습니다. OpenAI 대시보드(https://platform.openai.com/settings/organization)에서:\n1. 올바른 프로젝트/조직을 선택했는지 확인\n2. DALL-E 모델 사용 권한이 활성화되어 있는지 확인\n3. API 키가 올바른 프로젝트에 속해 있는지 확인해주세요.\n\n참고: DALL-E 2는 대부분의 프로젝트에서 사용 가능합니다.`)
    } else if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
      throw new Error('이미지 생성 요청이 실패했습니다. 일기 내용을 확인하거나 잠시 후 다시 시도해주세요.')
    }
    
    throw new Error(`이미지 생성 실패: ${errorMessage || '알 수 없는 오류'}`)
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
