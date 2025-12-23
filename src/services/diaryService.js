import { supabase } from '../config/supabase.js'
import { generateDiaryImage } from './aiImageService.js'

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
  try {
    // 기존 일기 확인
    const existing = await getDiaryByDate(date)
    
    let imageUrl = existing?.image_url || null
    let imagePrompt = existing?.image_prompt || null
    
    // 이미지가 없거나 재생성 요청이 있으면 생성
    if (!imageUrl || regenerateImage) {
      try {
        const { imageUrl: generatedUrl, prompt } = await generateDiaryImage(content)
        imageUrl = generatedUrl
        imagePrompt = prompt
      } catch (error) {
        console.error('이미지 생성 실패:', error)
        // 이미지 생성 실패해도 일기는 저장
        // 사용자에게 경고 메시지 표시는 UI에서 처리
      }
    }
    
    // 일기 저장 또는 업데이트
    const { data, error } = await supabase
      .from('diaries')
      .upsert({
        date,
        content,
        image_url: imageUrl,
        image_prompt: imagePrompt,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'date',
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
  try {
    const { data, error } = await supabase
      .from('diaries')
      .select('*')
      .eq('date', date)
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
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`
    
    const { data, error } = await supabase
      .from('diaries')
      .select('*')
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
  try {
    const { error } = await supabase
      .from('diaries')
      .delete()
      .eq('date', date)
    
    if (error) {
      throw error
    }
  } catch (error) {
    console.error('일기 삭제 오류:', error)
    throw error
  }
}
