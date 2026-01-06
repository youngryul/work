/**
 * 5년 질문 일기 서비스
 * 질문 조회 및 답변 관리
 */
import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 날짜를 day_of_year로 변환 (1-365)
 * @param {Date} date - 날짜 객체
 * @returns {number} day_of_year (1-365)
 */
function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date - start
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

/**
 * 특정 날짜의 질문 조회
 * @param {Date} date - 날짜 객체
 * @returns {Promise<Object|null>} 질문 객체
 */
export async function getQuestionByDate(date) {
  try {
    const dayOfYear = getDayOfYear(date)
    
    const { data, error } = await supabase
      .from('five_year_questions')
      .select('*')
      .eq('day_of_year', dayOfYear)
      .maybeSingle()

    if (error) {
      console.error('질문 조회 오류:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('질문 조회 실패:', error)
    throw error
  }
}

/**
 * 특정 질문에 대한 사용자의 답변 조회 (최대 5년치)
 * @param {string} questionId - 질문 ID
 * @param {number} currentYear - 현재 연도
 * @returns {Promise<Array>} 답변 목록 (연도별 정렬, 최신순)
 */
export async function getAnswersByQuestion(questionId, currentYear) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    // 최대 5년치 답변 조회 (현재 연도 포함)
    const startYear = currentYear - 4
    
    const { data, error } = await supabase
      .from('five_year_answers')
      .select('*')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .gte('year', startYear)
      .lte('year', currentYear)
      .order('year', { ascending: false })

    if (error) {
      console.error('답변 조회 오류:', error)
      throw error
    }

    return data || []
  } catch (error) {
    console.error('답변 조회 실패:', error)
    throw error
  }
}

/**
 * 특정 날짜의 질문과 답변 조회
 * @param {Date} date - 날짜 객체
 * @returns {Promise<Object>} 질문과 답변 목록
 */
export async function getQuestionAndAnswersByDate(date) {
  try {
    const question = await getQuestionByDate(date)
    if (!question) {
      return { question: null, answers: [] }
    }

    const currentYear = date.getFullYear()
    const answers = await getAnswersByQuestion(question.id, currentYear)

    return {
      question,
      answers,
    }
  } catch (error) {
    console.error('질문 및 답변 조회 실패:', error)
    throw error
  }
}

/**
 * 답변 저장 또는 업데이트
 * @param {string} questionId - 질문 ID
 * @param {number} year - 연도
 * @param {string} content - 답변 내용
 * @returns {Promise<Object>} 저장된 답변
 */
export async function saveAnswer(questionId, year, content) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    // 기존 답변 확인
    const { data: existing } = await supabase
      .from('five_year_answers')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .eq('year', year)
      .maybeSingle()

    if (existing) {
      // 업데이트
      const { data, error } = await supabase
        .from('five_year_answers')
        .update({ content })
        .eq('id', existing.id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('답변 업데이트 오류:', error)
        throw error
      }

      return data
    } else {
      // 생성
      const { data, error } = await supabase
        .from('five_year_answers')
        .insert({
          user_id: userId,
          question_id: questionId,
          year,
          content,
        })
        .select()
        .single()

      if (error) {
        console.error('답변 생성 오류:', error)
        throw error
      }

      return data
    }
  } catch (error) {
    console.error('답변 저장 실패:', error)
    throw error
  }
}

/**
 * 답변 삭제
 * @param {string} answerId - 답변 ID
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
export async function deleteAnswer(answerId) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const { error } = await supabase
      .from('five_year_answers')
      .delete()
      .eq('id', answerId)
      .eq('user_id', userId)

    if (error) {
      console.error('답변 삭제 오류:', error)
      throw error
    }

    return true
  } catch (error) {
    console.error('답변 삭제 실패:', error)
    throw error
  }
}

/**
 * 특정 연도의 모든 답변 조회
 * @param {number} year - 연도
 * @returns {Promise<Array>} 답변 목록
 */
export async function getAnswersByYear(year) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('five_year_answers')
      .select(`
        *,
        five_year_questions (
          id,
          question_text,
          day_of_year
        )
      `)
      .eq('user_id', userId)
      .eq('year', year)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('연도별 답변 조회 오류:', error)
      throw error
    }

    return data || []
  } catch (error) {
    console.error('연도별 답변 조회 실패:', error)
    throw error
  }
}

