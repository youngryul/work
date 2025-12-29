/**
 * 감정 일기 이미지 생성 서비스
 * Supabase Edge Function을 통해 OpenAI DALL-E 모델을 사용하여 감정 기반 이미지 생성
 */
import { supabase } from '../config/supabase.js'

/**
 * Supabase Edge Function을 통해 감정 분석 기반 이미지 생성
 * @param {string} diaryContent - 일기 내용
 * @returns {Promise<{imageUrl: string, prompt: string, emotion?: string, scene?: string}>} 생성된 이미지 URL, 프롬프트, 감정, 장면
 */
export async function generateDiaryImageFree(diaryContent) {
  try {
    // Supabase URL 확인
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) {
      throw new Error('Supabase URL이 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_URL을 추가해주세요.')
    }

    // Edge Function URL 구성
    const functionName = 'generate-image-huggingface'
    const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`
    
    // Supabase Anon Key 가져오기
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!anonKey) {
      throw new Error('Supabase Anon Key가 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_ANON_KEY를 추가해주세요.')
    }

    // Edge Function 직접 호출 (fetch 사용)
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        diaryContent,
      }),
    })

    // 응답 확인
    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText || response.statusText }
      }

      // 404 오류는 Edge Function이 배포되지 않았음을 의미
      if (response.status === 404) {
        throw new Error(
          `Edge Function '${functionName}'이 배포되지 않았습니다. ` +
          `Supabase 대시보드 > Edge Functions에서 '${functionName}' 함수를 생성하고 배포해주세요.`
        )
      }

      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data || !data.imageUrl) {
      throw new Error(data?.error || '이미지 생성 실패: 응답 데이터가 올바르지 않습니다.')
    }

    return {
      imageUrl: data.imageUrl,
      prompt: data.prompt,
      emotion: data.emotion,
      scene: data.scene,
    }
  } catch (error) {
    console.error('무료 이미지 생성 오류:', error)
    
    const errorMessage = error.message || error.toString() || ''
    
    // Edge Function 배포 관련 오류
    if (errorMessage.includes('배포되지 않았습니다') || errorMessage.includes('not found') || errorMessage.includes('404')) {
      throw new Error(
        `Edge Function이 배포되지 않았습니다. ` +
        `Supabase 대시보드 > Edge Functions에서 'generate-image-huggingface' 함수를 생성하고 배포해주세요. ` +
        `또한 Settings > Edge Functions > Secrets에서 HUGGINGFACE_API_KEY를 설정해주세요.`
      )
    }
    
    // Edge Function에서 반환한 오류 메시지 그대로 전달
    if (errorMessage.includes('rate_limit') || errorMessage.includes('Rate limit') || errorMessage.includes('사용량 제한')) {
      throw new Error('API 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.')
    } else if (errorMessage.includes('quota') || errorMessage.includes('Quota') || errorMessage.includes('할당량')) {
      throw new Error('무료 할당량을 초과했습니다. Hugging Face Pro로 업그레이드하거나 내일 다시 시도해주세요.')
    } else if (errorMessage.includes('model is currently loading') || errorMessage.includes('로딩 중')) {
      throw new Error('모델이 로딩 중입니다. 30초 후 다시 시도해주세요.')
    }
    
    throw new Error(`이미지 생성 실패: ${errorMessage || '알 수 없는 오류'}`)
  }
}


