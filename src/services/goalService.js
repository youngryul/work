/**
 * 목표 관리 서비스
 * 연간, 월별, 주간, 일간 목표 관리
 */
import { supabase } from '../config/supabase.js'
import { MAX_YEARLY_GOALS, MAX_MONTHLY_GOALS } from '../constants/goalCategories.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 연간 목표 목록 조회
 * @param {number} year - 연도 (기본값: 2026)
 * @returns {Promise<Array>} 연간 목표 목록
 */
export async function getYearlyGoals(year = 2026) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('yearly_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return (data || []).map(parseYearlyGoal)
  } catch (error) {
    console.error('연간 목표 조회 오류:', error)
    throw error
  }
}

/**
 * 연간 목표 생성
 * @param {Object} goalData - 목표 데이터
 * @returns {Promise<Object>} 생성된 목표
 */
export async function createYearlyGoal(goalData) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    // 최대 개수 확인
    const existingGoals = await getYearlyGoals(goalData.year || 2026)
    if (existingGoals.length >= MAX_YEARLY_GOALS) {
      throw new Error(`연간 목표는 최대 ${MAX_YEARLY_GOALS}개까지 등록할 수 있습니다.`)
    }

    // 같은 영역 중복 확인
    const duplicate = existingGoals.find(g => g.category === goalData.category)
    if (duplicate) {
      throw new Error('해당 영역에는 이미 목표가 등록되어 있습니다.')
    }

    const { data, error } = await supabase
      .from('yearly_goals')
      .insert([{
        year: goalData.year || 2026,
        category: goalData.category,
        title: goalData.title,
        description: goalData.description || null,
        measurement_criteria: goalData.measurementCriteria || null,
        obstacles: goalData.obstacles || null,
        strategy: goalData.strategy || null,
        progress_percentage: 0,
        status: 'ACTIVE',
        user_id: userId,
      }])
      .select()
      .single()

    if (error) {
      throw error
    }

    return parseYearlyGoal(data)
  } catch (error) {
    console.error('연간 목표 생성 오류:', error)
    throw error
  }
}

/**
 * 연간 목표 수정
 * @param {string} id - 목표 ID
 * @param {Object} goalData - 수정할 데이터
 * @returns {Promise<Object>} 수정된 목표
 */
export async function updateYearlyGoal(id, goalData) {
  try {
    const updateData = {}
    if (goalData.title !== undefined) updateData.title = goalData.title
    if (goalData.description !== undefined) updateData.description = goalData.description
    if (goalData.measurementCriteria !== undefined) updateData.measurement_criteria = goalData.measurementCriteria
    if (goalData.obstacles !== undefined) updateData.obstacles = goalData.obstacles
    if (goalData.strategy !== undefined) updateData.strategy = goalData.strategy
    if (goalData.progressPercentage !== undefined) updateData.progress_percentage = goalData.progressPercentage
    if (goalData.status !== undefined) updateData.status = goalData.status

    const userId = await getCurrentUserId()
    if (!userId) {
      throw new Error('로그인이 필요합니다.')
    }

    const { data, error } = await supabase
      .from('yearly_goals')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return parseYearlyGoal(data)
  } catch (error) {
    console.error('연간 목표 수정 오류:', error)
    throw error
  }
}

/**
 * 연간 목표 삭제
 * @param {string} id - 목표 ID
 * @returns {Promise<void>}
 */
export async function deleteYearlyGoal(id) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const { error } = await supabase
      .from('yearly_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('연간 목표 삭제 오류:', error)
    throw error
  }
}

/**
 * 월별 목표 목록 조회
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {Promise<Array>} 월별 목표 목록
 */
export async function getMonthlyGoals(year, month) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('monthly_goals')
      .select('*, yearly_goals(*)')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return (data || []).map(parseMonthlyGoal)
  } catch (error) {
    console.error('월별 목표 조회 오류:', error)
    throw error
  }
}

/**
 * 월별 목표 생성
 * @param {Object} goalData - 목표 데이터
 * @returns {Promise<Object>} 생성된 목표
 */
export async function createMonthlyGoal(goalData) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    // 최대 개수 확인
    const existingGoals = await getMonthlyGoals(goalData.year, goalData.month)
    if (existingGoals.length >= MAX_MONTHLY_GOALS) {
      throw new Error(`월별 목표는 최대 ${MAX_MONTHLY_GOALS}개까지 등록할 수 있습니다.`)
    }

    const { data, error } = await supabase
      .from('monthly_goals')
      .insert([{
        yearly_goal_id: goalData.yearlyGoalId,
        year: goalData.year,
        month: goalData.month,
        title: goalData.title,
        description: goalData.description || null,
        status: 'IN_PROGRESS',
        progress_percentage: 0,
        user_id: userId,
      }])
      .select('*, yearly_goals(*)')
      .single()

    if (error) {
      throw error
    }

    return parseMonthlyGoal(data)
  } catch (error) {
    console.error('월별 목표 생성 오류:', error)
    throw error
  }
}

/**
 * 월별 목표 수정
 * @param {string} id - 목표 ID
 * @param {Object} goalData - 수정할 데이터
 * @returns {Promise<Object>} 수정된 목표
 */
export async function updateMonthlyGoal(id, goalData) {
  try {
    const updateData = {}
    if (goalData.title !== undefined) updateData.title = goalData.title
    if (goalData.description !== undefined) updateData.description = goalData.description
    if (goalData.status !== undefined) updateData.status = goalData.status
    if (goalData.progressPercentage !== undefined) updateData.progress_percentage = goalData.progressPercentage

    const userId = await getCurrentUserId()
    if (!userId) {
      throw new Error('로그인이 필요합니다.')
    }

    const { data, error } = await supabase
      .from('monthly_goals')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, yearly_goals(*)')
      .single()

    if (error) {
      throw error
    }

    return parseMonthlyGoal(data)
  } catch (error) {
    console.error('월별 목표 수정 오류:', error)
    throw error
  }
}

/**
 * 월별 목표 삭제
 * @param {string} id - 목표 ID
 * @returns {Promise<void>}
 */
export async function deleteMonthlyGoal(id) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const { error } = await supabase
      .from('monthly_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('월별 목표 삭제 오류:', error)
    throw error
  }
}

/**
 * 주간 행동 목록 조회
 * @param {string} monthlyGoalId - 월별 목표 ID
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {number} weekNumber - 주차
 * @returns {Promise<Array>} 주간 행동 목록
 */
export async function getWeeklyActions(monthlyGoalId, year, month, weekNumber) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('weekly_actions')
      .select('*')
      .eq('user_id', userId)
      .eq('monthly_goal_id', monthlyGoalId)
      .eq('year', year)
      .eq('month', month)
      .eq('week_number', weekNumber)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return (data || []).map(parseWeeklyAction)
  } catch (error) {
    console.error('주간 행동 조회 오류:', error)
    throw error
  }
}

/**
 * 주간 행동 생성
 * @param {Object} actionData - 행동 데이터
 * @returns {Promise<Object>} 생성된 행동
 */
export async function createWeeklyAction(actionData) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const { data, error } = await supabase
      .from('weekly_actions')
      .insert([{
        monthly_goal_id: actionData.monthlyGoalId,
        year: actionData.year,
        month: actionData.month,
        week_number: actionData.weekNumber,
        action_text: actionData.actionText,
        is_completed: false,
        user_id: userId,
      }])
      .select()
      .single()

    if (error) {
      throw error
    }

    return parseWeeklyAction(data)
  } catch (error) {
    console.error('주간 행동 생성 오류:', error)
    throw error
  }
}

/**
 * 주간 행동 완료 토글
 * @param {string} id - 행동 ID
 * @param {boolean} isCompleted - 완료 여부
 * @returns {Promise<Object>} 업데이트된 행동
 */
export async function toggleWeeklyAction(id, isCompleted) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const updateData = {
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    }

    const { data, error } = await supabase
      .from('weekly_actions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return parseWeeklyAction(data)
  } catch (error) {
    console.error('주간 행동 업데이트 오류:', error)
    throw error
  }
}

/**
 * 일간 체크리스트 조회
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @returns {Promise<Array>} 일간 체크리스트
 */
export async function getDailyChecks(date) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('daily_checks')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return (data || []).map(parseDailyCheck)
  } catch (error) {
    console.error('일간 체크리스트 조회 오류:', error)
    throw error
  }
}

/**
 * 일간 체크리스트 생성
 * @param {Object} checkData - 체크리스트 데이터
 * @returns {Promise<Object>} 생성된 체크리스트
 */
export async function createDailyCheck(checkData) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const { data, error } = await supabase
      .from('daily_checks')
      .insert([{
        weekly_action_id: checkData.weeklyActionId || null,
        date: checkData.date,
        content: checkData.content,
        is_completed: false,
        user_id: userId,
      }])
      .select()
      .single()

    if (error) {
      throw error
    }

    // 오늘 할 일에 자동 추가 (오늘 날짜인 경우)
    const today = new Date().toISOString().split('T')[0]
    if (checkData.date === today && checkData.weeklyActionId) {
      try {
        // taskService를 동적 import하여 순환 참조 방지
        const { createTask } = await import('./taskService.js')
        await createTask(checkData.content, '기타', true)
      } catch (taskError) {
        // 오늘 할 일 추가 실패해도 체크리스트는 생성됨
        console.warn('오늘 할 일 자동 추가 실패:', taskError)
      }
    }

    return parseDailyCheck(data)
  } catch (error) {
    console.error('일간 체크리스트 생성 오류:', error)
    throw error
  }
}

/**
 * 주간 행동에서 일간 체크리스트 자동 생성
 * 매일 해당 날짜에 자동으로 체크리스트 항목 생성
 * @param {string} weeklyActionId - 주간 행동 ID
 * @param {string} actionText - 행동 내용
 * @param {string} date - 날짜 (YYYY-MM-DD)
 * @returns {Promise<Object>} 생성된 체크리스트
 */
export async function autoCreateDailyCheckFromWeeklyAction(weeklyActionId, actionText, date) {
  try {
    // 이미 존재하는지 확인
    const existing = await getDailyChecks(date)
    const alreadyExists = existing.some(
      check => check.content === actionText && check.weeklyActionId === weeklyActionId
    )

    if (alreadyExists) {
      return null
    }

    // 체크리스트 생성
    return await createDailyCheck({
      weeklyActionId,
      date,
      content: actionText,
    })
  } catch (error) {
    console.error('자동 체크리스트 생성 오류:', error)
    return null
  }
}

/**
 * 일간 체크리스트 완료 토글
 * @param {string} id - 체크리스트 ID
 * @param {boolean} isCompleted - 완료 여부
 * @returns {Promise<Object>} 업데이트된 체크리스트
 */
export async function toggleDailyCheck(id, isCompleted) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const updateData = {
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    }

    const { data, error } = await supabase
      .from('daily_checks')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return parseDailyCheck(data)
  } catch (error) {
    console.error('일간 체크리스트 업데이트 오류:', error)
    throw error
  }
}

/**
 * 월별 회고 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 * @returns {Promise<Object|null>} 월별 회고
 */
export async function getMonthlyReflection(year, month) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('monthly_reflections')
      .select('*')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw error
    }

    return parseMonthlyReflection(data)
  } catch (error) {
    console.error('월별 회고 조회 오류:', error)
    throw error
  }
}

/**
 * 월별 회고 생성/수정
 * @param {Object} reflectionData - 회고 데이터
 * @returns {Promise<Object>} 생성/수정된 회고
 */
export async function saveMonthlyReflection(reflectionData) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const { data, error } = await supabase
      .from('monthly_reflections')
      .upsert({
        year: reflectionData.year,
        month: reflectionData.month,
        achievement_rate: reflectionData.achievementRate || null,
        best_choice: reflectionData.bestChoice || null,
        failure_reason: reflectionData.failureReason || null,
        keep_next_month: reflectionData.keepNextMonth || null,
        drop_next_month: reflectionData.dropNextMonth || null,
        reflection_text: reflectionData.reflectionText || null,
        user_id: userId,
      }, {
        onConflict: 'year,month,user_id',
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return parseMonthlyReflection(data)
  } catch (error) {
    console.error('월별 회고 저장 오류:', error)
    throw error
  }
}

/**
 * 다음 달 목표 등록 가능 여부 확인 (회고 작성 필수)
 * @param {number} year - 연도
 * @param {number} month - 월
 * @returns {Promise<boolean>} 등록 가능 여부
 */
export async function canCreateNextMonthGoals(year, month) {
  try {
    const reflection = await getMonthlyReflection(year, month)
    return reflection !== null
  } catch (error) {
    console.error('회고 확인 오류:', error)
    return false
  }
}

// 데이터 파싱 헬퍼 함수들
function parseYearlyGoal(data) {
  return {
    id: data.id,
    year: data.year,
    category: data.category,
    title: data.title,
    description: data.description,
    measurementCriteria: data.measurement_criteria,
    obstacles: data.obstacles,
    strategy: data.strategy,
    progressPercentage: data.progress_percentage,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

function parseMonthlyGoal(data) {
  return {
    id: data.id,
    yearlyGoalId: data.yearly_goal_id,
    yearlyGoal: data.yearly_goals ? parseYearlyGoal(data.yearly_goals) : null,
    year: data.year,
    month: data.month,
    title: data.title,
    description: data.description,
    status: data.status,
    progressPercentage: data.progress_percentage,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

function parseWeeklyAction(data) {
  return {
    id: data.id,
    monthlyGoalId: data.monthly_goal_id,
    year: data.year,
    month: data.month,
    weekNumber: data.week_number,
    actionText: data.action_text,
    isCompleted: data.is_completed,
    completedAt: data.completed_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

function parseDailyCheck(data) {
  return {
    id: data.id,
    weeklyActionId: data.weekly_action_id,
    date: data.date,
    content: data.content,
    isCompleted: data.is_completed,
    completedAt: data.completed_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

function parseMonthlyReflection(data) {
  return {
    id: data.id,
    year: data.year,
    month: data.month,
    achievementRate: data.achievement_rate,
    bestChoice: data.best_choice,
    failureReason: data.failure_reason,
    keepNextMonth: data.keep_next_month,
    dropNextMonth: data.drop_next_month,
    reflectionText: data.reflection_text,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

