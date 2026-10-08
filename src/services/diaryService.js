import { supabase } from '../config/supabase.js'
import {
  assertSufficientTokensForFourCutGeneration,
  consumeTokensForFourCutGeneration,
} from './aiTokenService.js'
import { generateDiaryFourCutScenes } from './freeImageService.js'
import { uploadImageFromUrl, uploadImageBlob } from './imageService.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { awardJellyForDiaryWrite } from './jellyService.js'
import { composeFourCutStrip } from '../utils/fourCutComposer.js'
import { DIARY_COVER_CANDIDATE_MAX, DIARY_MODE } from '../constants/diaryModes.js'
import { AI_FOUR_CUT_TOKEN_COST } from '../constants/aiTokenSettings.js'

/**
 * 일기 서비스
 * Supabase를 통한 일기 CRUD 작업 및 AI 이미지 생성
 */

function parseSceneUrls(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.filter(Boolean) : []
    } catch {
      return []
    }
  }
  return []
}

function normalizeDiaryRow(data) {
  if (!data) return null
  return {
    ...data,
    imageUrl: data.image_url,
    imagePrompt: data.image_prompt,
    emotion: data.emotion,
    attachedImages: data.attached_images || [],
    fourCutUrl: data.four_cut_url || null,
    fourCutSceneUrls: parseSceneUrls(data.four_cut_scene_urls),
    coverImageUrl: data.cover_image_url || null,
  }
}

/**
 * 달력 대문 후보 (AI 4컷 장면·스트립 + 첨부 사진)
 * @param {object|null} diary
 * @returns {string[]}
 */
export function getDiaryCoverCandidates(diary) {
  if (!diary) return []
  const urls = []
  const push = (url) => {
    if (url && !urls.includes(url) && urls.length < DIARY_COVER_CANDIDATE_MAX) {
      urls.push(url)
    }
  }
  ;(diary.fourCutSceneUrls || []).forEach(push)
  push(diary.fourCutUrl)
  ;(diary.attachedImages || []).forEach(push)
  push(diary.imageUrl)
  return urls
}

/**
 * 달력 썸네일 URL
 * @param {object|null} diary
 * @returns {string|null}
 */
export function getDiaryThumbUrl(diary) {
  if (!diary) return null
  return diary.coverImageUrl
    || diary.imageUrl
    || diary.fourCutSceneUrls?.[0]
    || diary.fourCutUrl
    || diary.attachedImages?.[0]
    || null
}

/**
 * 이미지 URL들로 4컷 스트립을 만들어 Storage에 업로드
 * @param {string[]} imageUrls
 * @param {string} date
 * @returns {Promise<string>}
 */
export async function uploadFourCutStrip(imageUrls, date) {
  const blob = await composeFourCutStrip(imageUrls, { dateLabel: date })
  const fileName = `${date}-fourcut-${Date.now()}.png`
  // uploadImage prepends folder/, so pass file as File with path via uploadImageBlob
  return uploadImageBlob(blob, 'diaries', fileName)
}

/**
 * 일기 저장
 * @param {string} date
 * @param {string} content
 * @param {boolean} _regenerateImage - 미사용 (AI 1컷 기능 제거)
 * @param {Array<string>} attachedImages - 첨부 사진
 * @param {{
 *   skipImageGeneration?: boolean,
 *   mode?: string,
 *   onFourCutProgress?: (info: { done: number, total: number, imageUrl?: string, fourCutUrl?: string }) => void,
 * }} [options]
 */
export async function saveDiary(
  date,
  content,
  _regenerateImage = false,
  attachedImages = [],
  options = {},
) {
  const {
    skipImageGeneration = false,
    mode = DIARY_MODE.NORMAL,
    onFourCutProgress,
  } = options
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const existing = await getDiaryByDate(date)

    let imageUrl = existing?.imageUrl || existing?.image_url || null
    let imagePrompt = existing?.imagePrompt || existing?.image_prompt || null
    let remainingBalance = null
    let emotion = null
    let fourCutUrl = existing?.fourCutUrl || existing?.four_cut_url || null
    let fourCutSceneUrls = existing?.fourCutSceneUrls || []
    let coverImageUrl = existing?.coverImageUrl || existing?.cover_image_url || null
    let tokensConsumedCount = 0
    let tokensUsed = 0

    if (mode === DIARY_MODE.AI_FOUR_CUT && !skipImageGeneration) {
      await assertSufficientTokensForFourCutGeneration()
      const permanentSceneUrls = []

      const scenes = await generateDiaryFourCutScenes(content, {
        onProgress: async ({ done, total, imageUrl: tempUrl, phase }) => {
          if (!tempUrl) {
            onFourCutProgress?.({ done, total, phase })
            return
          }
          let permanent = tempUrl
          try {
            const uploaded = await uploadImageFromUrl(
              tempUrl,
              'diaries',
              `${date}-scene${permanentSceneUrls.length + 1}-${Date.now()}.png`,
            )
            if (uploaded) permanent = uploaded
          } catch {
            // 임시 URL 유지
          }
          permanentSceneUrls.push(permanent)
          onFourCutProgress?.({
            done: permanentSceneUrls.length,
            total,
            imageUrl: permanent,
            phase: phase || 'generating',
          })
        },
      })

      emotion = scenes.emotion
      imagePrompt = scenes.prompts.join('\n---\n')
      fourCutSceneUrls = permanentSceneUrls.length > 0 ? permanentSceneUrls : scenes.imageUrls
      fourCutUrl = await uploadFourCutStrip(fourCutSceneUrls, date)
      imageUrl = fourCutSceneUrls[0] || fourCutUrl
      // 대문이 없거나 이전 AI 4컷 이미지였다면 새 장면으로 교체 (첨부 사진을 대문으로 골랐다면 유지)
      const previousAiUrls = [...(existing?.fourCutSceneUrls || []), existing?.fourCutUrl, existing?.imageUrl]
      if (!coverImageUrl || previousAiUrls.includes(coverImageUrl)) {
        coverImageUrl = fourCutSceneUrls[0] || fourCutUrl
      }
      onFourCutProgress?.({
        done: fourCutSceneUrls.length,
        total: fourCutSceneUrls.length,
        fourCutUrl,
      })
      remainingBalance = await consumeTokensForFourCutGeneration()
      tokensConsumedCount = 1
      tokensUsed = AI_FOUR_CUT_TOKEN_COST
    }

    const upsertData = {
      date,
      content,
      user_id: userId,
      attached_images: attachedImages && attachedImages.length > 0 ? attachedImages : [],
      updated_at: new Date().toISOString(),
    }

    if (imageUrl !== null) upsertData.image_url = imageUrl
    if (imagePrompt !== null) upsertData.image_prompt = imagePrompt
    if (emotion !== null) upsertData.emotion = emotion
    if (fourCutUrl !== null) upsertData.four_cut_url = fourCutUrl
    if (fourCutSceneUrls) upsertData.four_cut_scene_urls = fourCutSceneUrls
    if (coverImageUrl !== null) upsertData.cover_image_url = coverImageUrl

    const { data, error } = await supabase
      .from('diaries')
      .upsert(upsertData, {
        onConflict: 'date,user_id',
      })
      .select()
      .single()

    if (error) {
      console.error('일기 저장 오류:', error)
      throw error
    }

    let jellyAwarded = 0
    try {
      const jellyResult = await awardJellyForDiaryWrite(date)
      jellyAwarded = jellyResult?.awarded ?? 0
    } catch (jellyError) {
      console.error('젤리 지급 실패:', jellyError)
    }

    return {
      ...normalizeDiaryRow(data),
      remainingBalance,
      tokensConsumed: tokensConsumedCount > 0,
      tokensConsumedCount,
      tokensUsed,
      jellyAwarded,
    }
  } catch (error) {
    console.error('일기 저장 실패:', error)
    throw error
  }
}

/**
 * 첨부 사진 자동 저장 (사진을 추가·삭제할 때마다 호출)
 * 대표 사진이 없거나 삭제된 사진이었다면 남은 후보 중 첫 장으로 바꾼다.
 * @param {string} date
 * @param {string} content
 * @param {string[]} attachedImages
 */
export async function saveDiaryAttachedImages(date, content, attachedImages) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const existing = await getDiaryByDate(date)
  const images = attachedImages || []
  const candidates = getDiaryCoverCandidates({ ...(existing || {}), attachedImages: images })
  const currentCover = existing?.coverImageUrl || null
  const coverImageUrl = currentCover && candidates.includes(currentCover)
    ? currentCover
    : (candidates[0] || null)

  const { data, error } = await supabase
    .from('diaries')
    .upsert({
      date,
      content,
      user_id: userId,
      attached_images: images,
      cover_image_url: coverImageUrl,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'date,user_id',
    })
    .select()
    .single()

  if (error) {
    console.error('첨부 사진 저장 오류:', error)
    throw error
  }

  // 젤리는 날짜당 1회만 지급됨
  try {
    await awardJellyForDiaryWrite(date)
  } catch (jellyError) {
    console.error('젤리 지급 실패:', jellyError)
  }

  return normalizeDiaryRow(data)
}

/**
 * 달력 대문 이미지 변경
 * @param {string} date
 * @param {string} coverImageUrl
 */
export async function updateDiaryCoverImage(date, coverImageUrl) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }
  if (!coverImageUrl) {
    throw new Error('대문 이미지를 선택해주세요.')
  }

  const { data, error } = await supabase
    .from('diaries')
    .update({
      cover_image_url: coverImageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('date', date)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('대문 이미지 변경 오류:', error)
    throw error
  }

  return normalizeDiaryRow(data)
}

export async function getDiaryByDate(date) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('diaries')
      .select('*')
      .eq('date', date)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    return normalizeDiaryRow(data)
  } catch (error) {
    console.error('일기 조회 오류:', error)
    throw error
  }
}

export async function getDiariesByMonth(year, month) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    const lastDay = new Date(year, month, 0).getDate()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('diaries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) {
      throw error
    }

    return (data || []).map(normalizeDiaryRow)
  } catch (error) {
    console.error('월별 일기 조회 오류:', error)
    throw error
  }
}

export async function deleteDiary(date) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const { error } = await supabase
      .from('diaries')
      .delete()
      .eq('date', date)
      .eq('user_id', userId)

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('일기 삭제 오류:', error)
    throw error
  }
}
