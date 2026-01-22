import { supabase } from '../config/supabase.js'
import { isAdmin } from './adminService.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 관리자 통계 서비스
 * 관리자만 접근 가능한 통계 데이터 제공
 */

/**
 * 사용자 통계 조회
 * @returns {Promise<Object>} 사용자 통계
 */
export async function getUserStatistics() {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const admin = await isAdmin(userId)
  if (!admin) {
    throw new Error('관리자 권한이 필요합니다.')
  }

  try {
    // auth.users는 직접 조회할 수 없으므로 여러 테이블에서 고유한 user_id를 수집
    // 총 사용자 수 (여러 테이블에서 고유한 user_id 개수)
    const userIds = new Set()

    // tasks 테이블에서 user_id 수집
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('user_id')
      if (!tasksError && tasksData) {
        tasksData.forEach(t => { if (t.user_id) userIds.add(t.user_id) })
      }
    } catch (error) {
      console.warn('tasks 테이블 조회 실패:', error)
    }

    // diaries 테이블에서 user_id 수집
    try {
      const { data: diariesData, error: diariesError } = await supabase
        .from('diaries')
        .select('user_id')
      if (!diariesError && diariesData) {
        diariesData.forEach(d => { if (d.user_id) userIds.add(d.user_id) })
      }
    } catch (error) {
      console.warn('diaries 테이블 조회 실패:', error)
    }

    const totalUsers = userIds.size

    // 활성 사용자 수 (최근 30일 내 활동)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    thirtyDaysAgo.setHours(0, 0, 0, 0)
    const thirtyDaysAgoTime = thirtyDaysAgo.getTime()

    const activeUserIds = new Set()

    // tasks 테이블에서 최근 활동한 사용자
    // 모든 데이터를 가져온 후 클라이언트에서 필터링 (created_at 필터 문제 방지)
    try {
      const { data: allTasks, error: activeTasksError } = await supabase
        .from('tasks')
        .select('user_id, createdat')
      if (!activeTasksError && allTasks) {
        allTasks.forEach(t => {
          if (!t.user_id) return
          // tasks 테이블은 createdat (BIGINT)만 있음
          const taskDate = t.createdat || t.createdAt
          if (taskDate && taskDate >= thirtyDaysAgoTime) {
            activeUserIds.add(t.user_id)
          }
        })
      }
    } catch (error) {
      console.warn('활성 사용자 조회 실패 (tasks):', error)
    }

    // diaries 테이블에서 최근 활동한 사용자
    try {
      const { data: allDiaries, error: activeDiariesError } = await supabase
        .from('diaries')
        .select('user_id, created_at')
      if (!activeDiariesError && allDiaries) {
        allDiaries.forEach(d => {
          if (!d.user_id) return
          const diaryDate = d.created_at ? new Date(d.created_at).getTime() : null
          if (diaryDate && diaryDate >= thirtyDaysAgoTime) {
            activeUserIds.add(d.user_id)
          }
        })
      }
    } catch (error) {
      console.warn('활성 사용자 조회 실패 (diaries):', error)
    }

    const activeUsers = activeUserIds.size

    // 최근 활동 사용자 (모든 사용자의 최근 활동)
    // 각 사용자의 가장 최근 활동 날짜와 메뉴를 찾음
    // Map<userId, {date: string, menu: string}>
    const userRecentActivity = new Map()

    // tasks 테이블에서 최근 활동
    try {
      const { data: allTasks, error: recentTasksError } = await supabase
        .from('tasks')
        .select('user_id, createdat')
      if (!recentTasksError && allTasks) {
        allTasks.forEach(task => {
          if (!task.user_id) return
          // tasks 테이블은 createdat (BIGINT)만 있음
          const taskDate = task.createdat || task.createdAt
          if (taskDate) {
            const existing = userRecentActivity.get(task.user_id)
            const existingTime = existing ? new Date(existing.date).getTime() : null
            // 더 최근 활동이면 업데이트
            if (!existingTime || taskDate > existingTime) {
              // BIGINT를 ISO 문자열로 변환
              userRecentActivity.set(task.user_id, {
                date: new Date(taskDate).toISOString(),
                menu: '할 일'
              })
            }
          }
        })
      }
    } catch (error) {
      console.warn('최근 사용자 조회 실패 (tasks):', error)
    }

    // diaries 테이블에서 최근 활동
    try {
      const { data: allDiaries, error: recentDiariesError } = await supabase
        .from('diaries')
        .select('user_id, created_at')
      if (!recentDiariesError && allDiaries) {
        allDiaries.forEach(diary => {
          if (!diary.user_id) return
          const diaryDate = diary.created_at ? new Date(diary.created_at).getTime() : null
          if (diaryDate) {
            const existing = userRecentActivity.get(diary.user_id)
            const existingTime = existing ? new Date(existing.date).getTime() : null
            // 더 최근 활동이면 업데이트
            if (!existingTime || diaryDate > existingTime) {
              userRecentActivity.set(diary.user_id, {
                date: diary.created_at,
                menu: '일기'
              })
            }
          }
        })
      }
    } catch (error) {
      console.warn('최근 사용자 조회 실패 (diaries):', error)
    }

    // reading_records 테이블에서 최근 활동
    try {
      const { data: allReadingRecords, error: recentReadingError } = await supabase
        .from('reading_records')
        .select('user_id, created_at')
      if (!recentReadingError && allReadingRecords) {
        allReadingRecords.forEach(record => {
          if (!record.user_id) return
          const recordDate = record.created_at ? new Date(record.created_at).getTime() : null
          if (recordDate) {
            const existing = userRecentActivity.get(record.user_id)
            const existingTime = existing ? new Date(existing.date).getTime() : null
            // 더 최근 활동이면 업데이트
            if (!existingTime || recordDate > existingTime) {
              userRecentActivity.set(record.user_id, {
                date: record.created_at,
                menu: '독서'
              })
            }
          }
        })
      }
    } catch (error) {
      console.warn('최근 사용자 조회 실패 (reading_records):', error)
    }

    // five_year_answers 테이블에서 최근 활동
    try {
      const { data: allAnswers, error: recentAnswersError } = await supabase
        .from('five_year_answers')
        .select('user_id, created_at')
      if (!recentAnswersError && allAnswers) {
        allAnswers.forEach(answer => {
          if (!answer.user_id) return
          const answerDate = answer.created_at ? new Date(answer.created_at).getTime() : null
          if (answerDate) {
            const existing = userRecentActivity.get(answer.user_id)
            const existingTime = existing ? new Date(existing.date).getTime() : null
            // 더 최근 활동이면 업데이트
            if (!existingTime || answerDate > existingTime) {
              userRecentActivity.set(answer.user_id, {
                date: answer.created_at,
                menu: '5년 질문'
              })
            }
          }
        })
      }
    } catch (error) {
      console.warn('최근 사용자 조회 실패 (five_year_answers):', error)
    }

    // 최근 활동 날짜 순으로 정렬 (최신순)
    const recentUsersData = Array.from(userRecentActivity.entries())
      .sort((a, b) => new Date(b[1].date) - new Date(a[1].date))
      .slice(0, 10)
      .map(([userId, activity]) => ({
        userId,
        date: activity.date,
        menu: activity.menu
      }))
    
    const recentUserIds = recentUsersData.map(u => u.userId)

    // 최근 사용자 이메일 조회
    let recentUsersWithEmail = []
    if (recentUserIds.length > 0) {
      try {
        const { data: userEmails, error: emailError } = await supabase.rpc('get_user_emails', {
          user_ids: recentUserIds
        })
        if (emailError) {
          console.warn('사용자 이메일 조회 실패:', emailError)
          // 이메일 조회 실패 시 user_id만 사용
          recentUsersWithEmail = recentUserIds.map(userId => ({
            userId,
            email: userId
          }))
        } else if (userEmails && Array.isArray(userEmails)) {
          // user_id를 키로 하는 맵 생성
          const emailMap = new Map()
          userEmails.forEach(u => {
            if (u.user_id) {
              emailMap.set(u.user_id, u.email || '이메일 없음')
            }
          })
          // recentUsersData 순서대로 이메일과 메뉴 정보 매핑
          recentUsersWithEmail = recentUsersData.map(userData => ({
            userId: userData.userId,
            email: emailMap.get(userData.userId) || '이메일 없음',
            menu: userData.menu,
            date: userData.date
          }))
        } else {
          // 이메일 조회 실패 시 user_id와 메뉴 정보만 사용
          recentUsersWithEmail = recentUsersData.map(userData => ({
            userId: userData.userId,
            email: userData.userId,
            menu: userData.menu,
            date: userData.date
          }))
        }
      } catch (error) {
        console.warn('사용자 이메일 조회 실패:', error)
        // 이메일 조회 실패 시 user_id와 메뉴 정보만 사용
        recentUsersWithEmail = recentUsersData.map(userData => ({
          userId: userData.userId,
          email: userData.userId,
          menu: userData.menu,
          date: userData.date
        }))
      }
    }

    return {
      totalUsers,
      activeUsers,
      recentSignUps: recentUserIds.length,
      recentUsers: recentUsersWithEmail,
    }
  } catch (error) {
    console.error('사용자 통계 조회 실패:', error)
    throw error
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
