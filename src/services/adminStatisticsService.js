import { supabase } from '../config/supabase.js'
import { isAdmin } from './adminService.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { getAllUsersWithRoles } from './userRoleService.js'

/**
 * 관리자 통계 서비스
 * 관리자만 접근 가능한 통계 데이터 제공
 */

/**
 * 사용자 통계 조회 (전체 사용자 목록·가입일 포함)
 * @returns {Promise<{ totalUsers: number, users: Array<{userId: string, email: string, role: string, createdAt: string|null}> }>}
 */
export async function getUserStatistics() {
  const users = await getAllUsersWithRoles()
  return {
    totalUsers: users.length,
    users,
  }
}

/**
 * 데이터 통계 조회
 * @returns {Promise<Object>} 데이터 통계
 */
export async function getDataStatistics() {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const admin = await isAdmin(userId)
  if (!admin) {
    throw new Error('관리자 권한이 필요합니다.')
  }

  try {
    // 일기 작성 수
    const { count: diaryCount, error: diaryError } = await supabase
      .from('diaries')
      .select('*', { count: 'exact', head: true })

    if (diaryError) {
      console.warn('일기 통계 조회 실패:', diaryError)
    }

    // 할 일 통계
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('completed')

    if (tasksError) {
      console.warn('할 일 통계 조회 실패:', tasksError)
    }

    const totalTasks = tasksData?.length || 0
    const completedTasks = tasksData?.filter(t => t.completed).length || 0
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

    // 5년 질문 답변 통계
    let answerCount = 0
    try {
      const { count, error: answerError } = await supabase
        .from('five_year_answers')
        .select('*', { count: 'exact', head: true })
      
      if (!answerError && count !== null) {
        answerCount = count
      } else if (answerError) {
        console.warn('5년 질문 답변 통계 조회 실패:', answerError)
      }
    } catch (error) {
      console.warn('5년 질문 답변 통계 조회 실패:', error)
    }

    // 질문 수
    const { count: questionCount, error: questionError } = await supabase
      .from('five_year_questions')
      .select('*', { count: 'exact', head: true })

    if (questionError) {
      console.warn('5년 질문 통계 조회 실패:', questionError)
    }

    const answerRate = questionCount > 0 ? (answerCount / questionCount) * 100 : 0

    // 독서 통계
    const { count: readingCount, error: readingError } = await supabase
      .from('reading_records')
      .select('*', { count: 'exact', head: true })

    if (readingError) {
      console.warn('독서 통계 조회 실패:', readingError)
    }

    // 총 읽은 페이지 수
    const { data: readingData } = await supabase
      .from('reading_records')
      .select('pages_read')

    const totalPages = readingData?.reduce((sum, r) => sum + (r.pages_read || 0), 0) || 0

    return {
      diaries: {
        total: diaryCount || 0,
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        completionRate: Math.round(completionRate * 100) / 100,
      },
      fiveYearQuestions: {
        totalQuestions: questionCount || 0,
        totalAnswers: answerCount || 0,
        answerRate: Math.round(answerRate * 100) / 100,
      },
      reading: {
        totalRecords: readingCount || 0,
        totalPages: totalPages,
      },
    }
  } catch (error) {
    console.error('데이터 통계 조회 실패:', error)
    throw error
  }
}
