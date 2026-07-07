import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { isAdmin } from './adminService.js'
import {
  JELLY_REWARD_DIARY_WRITE,
  JELLY_REWARD_FIVE_YEAR_ANSWER,
  JELLY_REWARD_HABIT_TRACKER_FIRST_TODAY,
  JELLY_REWARD_REASON,
  JELLY_REWARD_TASK_COMPLETE,
  JELLY_REWARD_WEIGHT_GOAL_REACHED,
  JELLY_REWARD_WEIGHT_RECORD,
} from '../constants/jellyRewards.js'
import { notifyJellyUpdated } from '../utils/jellyEvents.js'

/**
 * @returns {Promise<number>}
 */
export async function getMyJellyBalance() {
  const userId = await getCurrentUserId()
  if (!userId) return 0

  try {
    const { data, error } = await supabase.rpc('get_my_jelly_balance')
    if (error) throw error
    return typeof data === 'number' ? data : Number(data) || 0
  } catch (error) {
    console.error('젤리 잔액 조회 실패:', error)
    return 0
  }
}

/**
 * @param {number} amount
 * @param {string} reason
 * @param {string} idempotencyKey
 * @returns {Promise<{ balance: number, awarded: number, alreadyAwarded: boolean }>}
 */
async function awardJelly(amount, reason, idempotencyKey) {
  const { data, error } = await supabase.rpc('award_jelly', {
    p_amount: amount,
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  })

  if (error) {
    console.error('젤리 지급 오류:', error)
    throw error
  }

  const result = {
    balance: data?.balance ?? 0,
    awarded: data?.awarded ?? 0,
    alreadyAwarded: Boolean(data?.alreadyAwarded),
  }

  if (result.awarded > 0) {
    notifyJellyUpdated({ balance: result.balance, awarded: result.awarded })
  }

  return result
}

/**
 * 할 일 완료 시 젤리 지급
 * @param {string} taskId
 * @param {number} completedAt
 */
export async function awardJellyForTaskComplete(taskId, completedAt) {
  const userId = await getCurrentUserId()
  if (!userId || !taskId || !completedAt) return null

  return awardJelly(
    JELLY_REWARD_TASK_COMPLETE,
    JELLY_REWARD_REASON.TASK_COMPLETE,
    `task:${taskId}:${completedAt}`,
  )
}

/**
 * 일기 작성 시 젤리 지급 (날짜당 1회)
 * @param {string} date - YYYY-MM-DD
 */
export async function awardJellyForDiaryWrite(date) {
  const userId = await getCurrentUserId()
  if (!userId || !date) return null

  return awardJelly(
    JELLY_REWARD_DIARY_WRITE,
    JELLY_REWARD_REASON.DIARY_WRITE,
    `diary:${date}`,
  )
}

/**
 * 몸무게 기록 시 젤리 지급 (날짜당 1회)
 * @param {string} date - YYYY-MM-DD
 */
export async function awardJellyForWeightRecord(date) {
  const userId = await getCurrentUserId()
  if (!userId || !date) return null

  return awardJelly(
    JELLY_REWARD_WEIGHT_RECORD,
    JELLY_REWARD_REASON.WEIGHT_RECORD,
    `weight:${date}`,
  )
}

/**
 * 목표 몸무게 달성 시 젤리 지급 (1회)
 * @param {string} goalKey - 목표 식별 키
 */
export async function awardJellyForWeightGoalReached(goalKey) {
  const userId = await getCurrentUserId()
  if (!userId || !goalKey) return null

  return awardJelly(
    JELLY_REWARD_WEIGHT_GOAL_REACHED,
    JELLY_REWARD_REASON.WEIGHT_GOAL_REACHED,
    `weight_goal:${goalKey}`,
  )
}

/**
 * 오늘 5년 질문 최초 답변 시 젤리 지급 (하루 1회)
 * @param {string} date - YYYY-MM-DD
 */
export async function awardJellyForFiveYearAnswer(date) {
  const userId = await getCurrentUserId()
  if (!userId || !date) return null

  return awardJelly(
    JELLY_REWARD_FIVE_YEAR_ANSWER,
    JELLY_REWARD_REASON.FIVE_YEAR_ANSWER,
    `five_year:${date}`,
  )
}

/**
 * 습관 트래커별 오늘 최초 달성 시 젤리 지급 (트래커·하루 1회)
 * @param {string} habitTrackerId
 * @param {string} date - YYYY-MM-DD
 */
export async function awardJellyForHabitTrackerFirstToday(habitTrackerId, date) {
  const userId = await getCurrentUserId()
  if (!userId || !habitTrackerId || !date) return null

  return awardJelly(
    JELLY_REWARD_HABIT_TRACKER_FIRST_TODAY,
    JELLY_REWARD_REASON.HABIT_TRACKER_FIRST_TODAY,
    `habit_tracker:${habitTrackerId}:${date}`,
  )
}

/**
 * 관리자: 특정 유저 젤리 잔액 설정
 * @param {string} targetUserId
 * @param {number} balance
 */
export async function setUserJellyBalance(targetUserId, balance) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const admin = await isAdmin(userId)
  if (!admin) throw new Error('관리자 권한이 필요합니다.')

  const { data, error } = await supabase.rpc('admin_set_user_jelly_balance', {
    p_user_id: targetUserId,
    p_balance: balance,
  })

  if (error) throw error

  const currentUserId = await getCurrentUserId()
  if (targetUserId === currentUserId) {
    notifyJellyUpdated({ balance })
  }

  return data
}

/**
 * 관리자: 전체 유저 + 젤리 잔액
 * @param {Array<{userId: string, email: string}>} users
 * @returns {Promise<Array<{userId: string, email: string, balance: number}>>}
 */
export async function getJellyBalancesForUsers(users) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const admin = await isAdmin(userId)
  if (!admin) throw new Error('관리자 권한이 필요합니다.')

  const ids = users.map((u) => u.userId).filter(Boolean)
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from('user_jelly')
    .select('user_id, balance')
    .in('user_id', ids)

  if (error) throw error

  const balanceMap = new Map()
  ;(data || []).forEach((row) => balanceMap.set(row.user_id, row.balance))

  return users.map((u) => ({
    userId: u.userId,
    email: u.email,
    balance: balanceMap.has(u.userId) ? balanceMap.get(u.userId) : 0,
  }))
}
