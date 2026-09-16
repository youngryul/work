import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { getStudySecondsByDate } from './studyTimeService.js'
import { getCompletedCountsByDate } from './taskService.js'

/**
 * 지난 달 통계 팝업이 이미 표시되었는지 확인
 * @param {string} periodMonth - 'YYYY-MM' 형식
 * @param {string} [userId] - 사용자 ID (옵셔널, 없으면 자동으로 가져옴)
 * @returns {Promise<boolean>}
 */
export async function hasSeenMonthlyStatsPopup(periodMonth, userId = null) {
  if (!userId) {
    userId = await getCurrentUserId()
  }
  if (!userId) return false

  try {
    const { data, error } = await supabase
      .from('monthly_stats_popups')
      .select('id')
      .eq('user_id', userId)
      .eq('period_month', periodMonth)
      .maybeSingle()

    if (error) {
      // RLS 관련 오류 등은 조용히 처리 (팝업을 표시하지 않은 것으로 간주)
      return false
    }

    return !!data
  } catch (error) {
    console.error('월간 통계 팝업 확인 오류:', error)
    return false
  }
}

/**
 * 지난 달 통계 팝업 표시 완료 기록
 * @param {string} periodMonth - 'YYYY-MM' 형식
 * @param {string} [userId] - 사용자 ID (옵셔널, 없으면 자동으로 가져옴)
 * @returns {Promise<void>}
 */
export async function markMonthlyStatsPopupSeen(periodMonth, userId = null) {
  if (!userId) {
    userId = await getCurrentUserId()
  }
  if (!userId) return

  try {
    const { error } = await supabase
      .from('monthly_stats_popups')
      .upsert(
        { user_id: userId, period_month: periodMonth },
        { onConflict: 'user_id,period_month', ignoreDuplicates: false },
      )

    if (error) {
      console.error('월간 통계 팝업 기록 오류:', error)
    }
  } catch (error) {
    console.error('월간 통계 팝업 기록 실패:', error)
  }
}

/**
 * 특정 연/월의 총 타이머 시간(초)과 총 완료 할일 개수 집계
 * @param {number} year
 * @param {number} month - 1~12
 * @returns {Promise<{ totalSeconds: number, totalCompletedTasks: number }>}
 */
export async function fetchMonthlyStatsSummary(year, month) {
  const [secondsByDate, countsByDate] = await Promise.all([
    getStudySecondsByDate(year, month),
    getCompletedCountsByDate(year, month),
  ])

  const totalSeconds = Object.values(secondsByDate).reduce((sum, s) => sum + (Number(s) || 0), 0)
  const totalCompletedTasks = Object.values(countsByDate).reduce((sum, c) => sum + (Number(c) || 0), 0)

  return { totalSeconds, totalCompletedTasks }
}
