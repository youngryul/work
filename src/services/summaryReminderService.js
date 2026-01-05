import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 오늘 요약 리마인더가 이미 표시되었는지 확인
 * @param {string} reminderType - 'weekly' | 'monthly'
 * @returns {Promise<boolean>} 오늘 리마인더가 표시되었으면 true
 */
export async function hasSummaryReminderToday(reminderType) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return false
  }

  try {
    const today = new Date()
    const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('summary_reminders')
      .select('id')
      .eq('user_id', userId)
      .eq('reminder_type', reminderType)
      .eq('reminder_date', todayDateString)
      .maybeSingle()

    // maybeSingle은 레코드가 없을 때 에러를 던지지 않지만, RLS 정책 문제로 406 에러가 발생할 수 있음
    // 에러가 발생해도 조용히 처리 (리마인더가 표시되지 않은 것으로 간주)
    if (error) {
      // 406 오류는 RLS 정책 문제일 수 있음 - 조용히 처리
      if (error.status === 406 || error.code === 'PGRST116') {
        return false
      }
      // 기타 에러도 조용히 처리 (앱이 계속 동작하도록)
      return false
    }

    return !!data
  } catch (error) {
    console.error('요약 리마인더 확인 오류:', error)
    return false
  }
}

/**
 * 오늘 요약 리마인더 표시 기록
 * @param {string} reminderType - 'weekly' | 'monthly'
 * @returns {Promise<void>}
 */
export async function markSummaryReminderShown(reminderType) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return
  }

  try {
    const today = new Date()
    const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const { error } = await supabase
      .from('summary_reminders')
      .upsert({
        user_id: userId,
        reminder_type: reminderType,
        reminder_date: todayDateString,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,reminder_type,reminder_date',
        ignoreDuplicates: false,
      })

    // 406 에러는 RLS 정책 문제일 수 있음 - 조용히 처리 (앱이 계속 동작하도록)
    if (error) {
      if (error.status === 406) {
        // RLS 정책 문제로 인한 에러는 조용히 처리
        return
      }
      console.error('요약 리마인더 기록 오류:', error)
      // 에러를 던지지 않고 조용히 처리
      return
    }
  } catch (error) {
    // 예외 발생 시에도 조용히 처리 (앱이 계속 동작하도록)
    if (error.status !== 406) {
      console.error('요약 리마인더 기록 실패:', error)
    }
  }
}

