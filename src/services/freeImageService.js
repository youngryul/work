/**
 * 무료 AI 이미지 생성 서비스 (Hugging Face Inference API 사용)
 * Stable Diffusion 모델을 사용하여 이미지 생성
 */

/**
 * 일기 내용을 이미지 생성 프롬프트로 변환
 * @param {string} content - 일기 내용
 * @returns {string} 이미지 생성 프롬프트
 */
function createImagePrompt(content) {
  const baseStyle = "simple line drawing, minimalist, black and white, doodle style, hand-drawn sketch, clean lines, journal illustration"
  
  const keywords = content
    .substring(0, 200)
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1)
    .slice(0, 10)
    .join(', ')
  
  return `${keywords}, ${baseStyle}`
}

/**
 * Hugging Face Inference API를 사용하여 이미지 생성
 * @param {string} diaryContent - 일기 내용
 * @returns {Promise<{imageUrl: string, prompt: string}>} 생성된 이미지 URL과 사용된 프롬프트
 */
export async function generateDiaryImageFree(diaryContent) {
  const apiKey = import.meta.env.VITE_HUGGINGFACE_API_KEY
  
  if (!apiKey) {
    throw new Error('Hugging Face API 키가 설정되지 않았습니다. .env 파일에 VITE_HUGGINGFACE_API_KEY를 추가해주세요.')
  }

  try {
    // 프롬프트 생성
    const prompt = createImagePrompt(diaryContent)
    
    // Hugging Face Inference API 호출
    // Stable Diffusion 모델 사용 (다른 모델로 변경 가능)
    const model = "stabilityai/stable-diffusion-xl-base-1.0" // 또는 "runwayml/stable-diffusion-v1-5"
    
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            num_inference_steps: 30,
            guidance_scale: 7.5,
            width: 1024,
            height: 1024,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`이미지 생성 실패: ${errorData.error || response.statusText}`)
    }

    // 이미지 데이터를 Blob으로 받기
    const imageBlob = await response.blob()
    
    // Blob을 Data URL로 변환
    const imageUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(imageBlob)
    })

    return {
      imageUrl,
      prompt,
    }
  } catch (error) {
    console.error('무료 이미지 생성 오류:', error)
    
    const errorMessage = error.message || error.toString() || ''
    
    if (errorMessage.includes('rate_limit') || errorMessage.includes('Rate limit')) {
      throw new Error('API 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.')
    } else if (errorMessage.includes('quota') || errorMessage.includes('Quota')) {
      throw new Error('무료 할당량을 초과했습니다. Hugging Face Pro로 업그레이드하거나 내일 다시 시도해주세요.')
    } else if (errorMessage.includes('model is currently loading')) {
      throw new Error('모델이 로딩 중입니다. 30초 후 다시 시도해주세요.')
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

