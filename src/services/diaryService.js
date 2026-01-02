import { supabase } from '../config/supabase.js'
import { generateDiaryImageFree } from './freeImageService.js'
import { uploadImageFromUrl } from './imageService.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 일기 서비스
 * Supabase를 통한 일기 CRUD 작업 및 AI 이미지 생성
 */

/**
 * 일기 저장 (이미지 자동 생성 포함)
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @param {string} content - 일기 내용
 * @param {boolean} regenerateImage - 이미지 재생성 여부 (기본값: false)
 * @returns {Promise<Object>} 저장된 일기
 */
export async function saveDiary(date, content, regenerateImage = false) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    // 기존 일기 확인
    const existing = await getDiaryByDate(date)
    
    let imageUrl = existing?.image_url || null
    let imagePrompt = existing?.image_prompt || null
    
    // 이미지가 없거나 재생성 요청이 있으면 생성
    if (!imageUrl || regenerateImage) {
      try {
        const { imageUrl: generatedUrl, prompt } = await generateDiaryImageFree(content)
        
        // OpenAI의 임시 URL을 Supabase Storage에 업로드하여 영구 저장
        try {
          // 재생성 시에는 타임스탬프를 추가하여 고유한 파일명 생성 (캐시 방지)
          const timestamp = Date.now()
          const fileName = regenerateImage 
            ? `${date}-${timestamp}.png` 
            : `${date}.png`
          
          const permanentUrl = await uploadImageFromUrl(
            generatedUrl,
            'diaries',
            fileName
          )
          
          // Edge Function이 임시 URL을 반환한 경우 (폴백) 확인
          if (permanentUrl && permanentUrl !== generatedUrl) {
            imageUrl = permanentUrl
          } else {
            // Edge Function이 없거나 실패한 경우 임시 URL 사용
            console.warn('Edge Function을 사용할 수 없습니다. 임시 URL을 사용합니다. (만료될 수 있음)')
            imageUrl = generatedUrl
          }
        } catch (uploadError) {
          console.error('이미지 업로드 실패, 임시 URL 사용:', uploadError)
          // 업로드 실패 시 임시 URL 사용 (나중에 만료될 수 있음)
          imageUrl = generatedUrl
        }
        
        imagePrompt = prompt
      } catch (error) {
        console.error('이미지 생성 실패:', error)
        // 이미지 생성 실패해도 일기는 저장
        // 이미지 URL과 프롬프트는 기존 값 유지 또는 null
        // 사용자에게 경고 메시지 표시는 UI에서 처리
        // 재생성 요청인 경우에만 에러를 다시 throw하여 UI에서 처리하도록 함
        if (regenerateImage) {
          // 재생성 실패 시 에러를 전파하여 UI에서 사용자에게 알림
          throw error
        }
        // 일반 저장 시에는 이미지 없이 일기만 저장
      }
    }
    
    // 일기 저장 또는 업데이트
    // created_at은 DEFAULT 값이 자동으로 설정됨
    // updated_at은 트리거가 자동으로 업데이트하지만, INSERT 시에는 명시적으로 설정
    const upsertData = {
      date,
      content,
      user_id: userId,
    }
    
    // image_url과 image_prompt는 null이 아닐 때만 포함
    if (imageUrl !== null) {
      upsertData.image_url = imageUrl
    }
    if (imagePrompt !== null) {
      upsertData.image_prompt = imagePrompt
    }
    
    // updated_at을 명시적으로 설정하여 트리거 오류 방지
    upsertData.updated_at = new Date().toISOString()
    
    // upsert 사용 (트리거 오류 방지를 위해 updated_at 명시)
    // 복합 UNIQUE 제약 조건 (date, user_id) 사용
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
    
    return {
      ...data,
      imageUrl: data.image_url,
      imagePrompt: data.image_prompt,
    }
  } catch (error) {
    console.error('일기 저장 실패:', error)
    throw error
  }
}

/**
 * 날짜별 일기 조회
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @returns {Promise<Object|null>} 일기 데이터
 */
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
        // 레코드를 찾을 수 없음
        return null
      }
      throw error
    }
    
    return data ? {
      ...data,
      imageUrl: data.image_url,
      imagePrompt: data.image_prompt,
    } : null
  } catch (error) {
    console.error('일기 조회 오류:', error)
    throw error
  }
}

/**
 * 월별 일기 목록 조회
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {Promise<Array>} 일기 목록 [{ date, content, imageUrl, ... }]
 */
export async function getDiariesByMonth(year, month) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    // 각 월의 실제 마지막 날짜 계산
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
    
    return (data || []).map(item => ({
      ...item,
      imageUrl: item.image_url,
      imagePrompt: item.image_prompt,
    }))
  } catch (error) {
    console.error('월별 일기 조회 오류:', error)
    throw error
  }
}

/**
 * 일기 삭제
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @returns {Promise<void>}
 */
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
