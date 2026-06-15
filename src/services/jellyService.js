import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import {
  JELLY_REWARD_DIARY_WRITE,
  JELLY_REWARD_REASON,
  JELLY_REWARD_TASK_COMPLETE,
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
