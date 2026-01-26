import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 네모 로직 완료 기록 저장
 * @param {string} puzzleId - 퍼즐 ID
 * @param {string} puzzleName - 퍼즐 이름
 * @param {number} puzzleSize - 퍼즐 크기
 * @returns {Promise<Object|null>} 저장된 완료 기록
 */
export async function saveNonogramCompletion(puzzleId, puzzleName, puzzleSize) {
  const userId = await getCurrentUserId()
  if (!userId) {
    console.warn('로그인이 필요합니다.')
    return null
  }

  try {
    // 먼저 기존 기록이 있는지 확인
    const { data: existing } = await supabase
      .from('nonogram_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('puzzle_id', puzzleId)
      .maybeSingle()

    let data, error

    if (existing) {
      // 기존 기록이 있으면 업데이트
      const { data: updateData, error: updateError } = await supabase
        .from('nonogram_completions')
        .update({
          completed_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()
      
      data = updateData
      error = updateError
    } else {
      // 기존 기록이 없으면 삽입
      const { data: insertData, error: insertError } = await supabase
        .from('nonogram_completions')
        .insert({
          user_id: userId,
          puzzle_id: puzzleId,
          puzzle_name: puzzleName,
          puzzle_size: puzzleSize,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single()
      
      data = insertData
      error = insertError
    }

    if (error) {
      console.error('네모 로직 완료 기록 저장 오류:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('네모 로직 완료 기록 저장 오류:', error)
    return null
  }
}

/**
 * 사용자의 네모 로직 완료 기록 조회
 * @returns {Promise<Array>} 완료 기록 목록
 */
export async function getNonogramCompletions() {
  const userId = await getCurrentUserId()
  if (!userId) {
    console.warn('로그인이 필요합니다.')
    return []
  }

  try {
    const { data, error } = await supabase
      .from('nonogram_completions')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })

    if (error) {
      console.error('네모 로직 완료 기록 조회 오류:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('네모 로직 완료 기록 조회 오류:', error)
    return []
  }
}

/**
 * 특정 퍼즐의 완료 여부 확인
 * @param {string} puzzleId - 퍼즐 ID
 * @returns {Promise<boolean>} 완료 여부
 */
export async function isPuzzleCompleted(puzzleId) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return false
  }

  try {
    const { data, error } = await supabase
      .from('nonogram_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('puzzle_id', puzzleId)
      .maybeSingle()

    if (error) {
      console.error('퍼즐 완료 여부 확인 오류:', error)
      return false
    }

    return !!data
  } catch (error) {
    console.error('퍼즐 완료 여부 확인 오류:', error)
    return false
  }
}
