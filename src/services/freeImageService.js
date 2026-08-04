/**
 * 감정 일기 이미지 생성 서비스
 * Supabase Edge Function을 통해 OpenAI 모델을 사용하여 감정 기반 이미지 생성
 */
import { AI_FOUR_CUT_SCENE_COUNT } from '../constants/diaryModes.js'

const POSILI_STYLE_FALLBACK =
  'Consistent art style: colorful crayon colored-pencil illustration, thick black outlines, soft paper texture. Main character is always the same Posili — a cute chubby round potato with a warm smile and tiny arms/legs, identical in every panel.'

/**
 * Edge Function 공통 호출
 * @param {Record<string, unknown>} body
 */
async function callGenerateImageFunction(body) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('Supabase URL이 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_URL을 추가해주세요.')
  }

  const functionName = 'generate-image-huggingface'
  const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!anonKey) {
    throw new Error('Supabase Anon Key가 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_ANON_KEY를 추가해주세요.')
  }

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
    } catch {
      errorData = { error: errorText || response.statusText }
    }

    if (response.status === 404) {
      throw new Error(
        `Edge Function '${functionName}'이 배포되지 않았습니다. ` +
          `Supabase 대시보드 > Edge Functions에서 '${functionName}' 함수를 생성하고 배포해주세요.`,
      )
    }

    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
  }

  return response.json()
}

function mapImageError(error) {
  const errorMessage = error.message || error.toString() || ''

  if (errorMessage.includes('배포되지 않았습니다') || errorMessage.includes('not found') || errorMessage.includes('404')) {
    return new Error(
      `Edge Function이 배포되지 않았습니다. ` +
        `Supabase 대시보드 > Edge Functions에서 'generate-image-huggingface' 함수를 생성하고 배포해주세요.`,
    )
  }

  if (errorMessage.includes('rate_limit') || errorMessage.includes('Rate limit') || errorMessage.includes('사용량 제한')) {
    return new Error('API 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.')
  }
  if (errorMessage.includes('quota') || errorMessage.includes('Quota') || errorMessage.includes('할당량')) {
    return new Error('무료 할당량을 초과했습니다. 내일 다시 시도해주세요.')
  }
  if (errorMessage.includes('model is currently loading') || errorMessage.includes('로딩 중')) {
    return new Error('모델이 로딩 중입니다. 30초 후 다시 시도해주세요.')
  }

  return new Error(`이미지 생성 실패: ${errorMessage || '알 수 없는 오류'}`)
}

/**
 * Supabase Edge Function을 통해 감정 분석 기반 이미지 생성
 * @param {string} diaryContent - 일기 내용
 * @param {{ sceneHint?: string, imagePrompt?: string }} [options]
 * @returns {Promise<{imageUrl: string, prompt: string, emotion?: string, scene?: string}>}
 */
export async function generateDiaryImageFree(diaryContent, options = {}) {
  try {
    let data
    if (options.imagePrompt) {
      data = await callGenerateImageFunction({ imagePrompt: options.imagePrompt })
    } else {
      const contentWithHint = options.sceneHint
        ? `${diaryContent}\n\n[Four-cut frame focus: ${options.sceneHint}]`
        : diaryContent
      data = await callGenerateImageFunction({ diaryContent: contentWithHint })
    }

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
    throw mapImageError(error)
  }
}

/**
 * 일기를 4컷용 시간순 4줄 요약으로 계획
 * @param {string} diaryContent
 * @returns {Promise<{ emotion: string|null, styleLock: string, panels: Array<object> }>}
 */
export async function planDiaryFourCut(diaryContent) {
  try {
    const data = await callGenerateImageFunction({
      action: 'plan_four_cut',
      diaryContent,
    })
    if (!data?.panels?.length) {
      throw new Error(data?.error || '4컷 요약 계획을 만들지 못했습니다.')
    }
    return {
      emotion: data.emotion || null,
      styleLock: data.styleLock || POSILI_STYLE_FALLBACK,
      panels: data.panels,
    }
  } catch (error) {
    console.error('4컷 요약 계획 오류:', error)
    throw mapImageError(error)
  }
}

/**
 * 4컷 패널용 최종 이미지 프롬프트
 * @param {{ styleLock: string, panels: Array<object> }} plan
 * @param {number} index
 */
function buildFourCutPanelPrompt(plan, index) {
  const panel = plan.panels[index] || {}
  const styleLock = plan.styleLock || POSILI_STYLE_FALLBACK
  return [
    styleLock,
    `Panel ${index + 1} of 4 in a chronological photo-booth story (${panel.timeLabel || 'moment'}).`,
    `Story beat: ${panel.summary || `Diary moment ${index + 1}`}.`,
    `Setting: ${panel.setting || 'everyday place'}.`,
    `Action: ${panel.action || 'Posili living this moment'}.`,
    'Keep Posili design, proportions, face, and crayon style identical to other panels.',
    'Do not default to food, meals, books, or studying unless this beat explicitly requires it.',
    'Show clear passage of time compared to other panels. Single clear composition, no collage.',
  ].join(' ')
}

const FALLBACK_SCENE_HINTS = [
  'chronological beat 1 — beginning of the day from the diary, avoid food/books unless diary says so',
  'chronological beat 2 — developing moment, different setting from beat 1',
  'chronological beat 3 — emotional peak or key event, diverse everyday situation',
  'chronological beat 4 — ending wrap-up of the day, consistent Posili crayon style',
]

/**
 * 일기 내용으로 AI 4컷용 장면 이미지 최대 4장 생성
 * 1) 일기 4줄 시간순 요약 2) 공통 그림체 잠금 3) 패널별 이미지 생성
 * @param {string} diaryContent
 * @param {{
 *   onProgress?: (info: { done: number, total: number, imageUrl?: string, phase?: string }) => void | Promise<void>,
 * }} [options]
 * @returns {Promise<{ imageUrls: string[], prompts: string[], emotion: string|null, successCount: number, plan?: object }>}
 */
export async function generateDiaryFourCutScenes(diaryContent, options = {}) {
  const total = AI_FOUR_CUT_SCENE_COUNT
  const imageUrls = []
  const prompts = []
  let emotion = null
  let plan = null

  await options.onProgress?.({ done: 0, total, phase: 'planning' })

  try {
    plan = await planDiaryFourCut(diaryContent)
    emotion = plan.emotion
  } catch (err) {
    console.warn('4컷 요약 계획 실패, 힌트 폴백 사용:', err)
  }

  for (let i = 0; i < total; i += 1) {
    let latestUrl
    try {
      let result
      if (plan?.panels?.[i]) {
        const imagePrompt = buildFourCutPanelPrompt(plan, i)
        result = await generateDiaryImageFree(diaryContent, { imagePrompt })
        if (result?.prompt) prompts.push(result.prompt)
        else prompts.push(imagePrompt)
      } else {
        result = await generateDiaryImageFree(diaryContent, {
          sceneHint: `Frame ${i + 1} of 4 — ${FALLBACK_SCENE_HINTS[i]}. Same Posili crayon style in every frame.`,
        })
        if (result?.prompt) prompts.push(result.prompt)
      }

      if (result?.imageUrl) {
        imageUrls.push(result.imageUrl)
        latestUrl = result.imageUrl
        if (!emotion && result.emotion) emotion = result.emotion
      }
    } catch (err) {
      console.error(`AI 4컷 ${i + 1}번째 장면 생성 실패:`, err)
      if (imageUrls.length === 0 && i === total - 1) {
        throw err
      }
    }
    await options.onProgress?.({
      done: i + 1,
      total,
      imageUrl: latestUrl,
      phase: 'generating',
    })
  }

  if (imageUrls.length === 0) {
    throw new Error('AI 4컷 이미지를 하나도 생성하지 못했습니다.')
  }

  return {
    imageUrls,
    prompts,
    emotion,
    successCount: imageUrls.length,
    plan,
  }
}
