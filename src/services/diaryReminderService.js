import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 오늘 일기 리마인더가 이미 표시되었는지 확인
 * @param {string} [userId] - 사용자 ID (옵셔널, 없으면 자동으로 가져옴)
 * @returns {Promise<boolean>} 오늘 리마인더가 표시되었으면 true
 */
export async function hasDiaryReminderToday(userId = null) {
  if (!userId) {
    userId = await getCurrentUserId()
  }
  if (!userId) {
    return false
  }

  try {
    const today = new Date()
    const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // DATE 타입 비교: 문자열 형식으로 직접 비교
    const { data: allData, error: listError } = await supabase
      .from('diary_reminders')
      .select('id, reminder_date')
      .eq('user_id', userId)
    
    if (listError) {
      // 전체 조회 실패 시 기존 방식으로 시도
      const { data, error } = await supabase
        .from('diary_reminders')
        .select('id, reminder_date')
        .eq('user_id', userId)
        .eq('reminder_date', todayDateString)
        .maybeSingle()
      
      if (error) {
        if (error.status === 406 || error.code === 'PGRST116') {
          return false
        }
        return false
      }
      
      if (data) {
        return true
      } else {
        return false
      }
    }
    
    // 전체 레코드에서 오늘 날짜 찾기
    const found = allData?.some(record => {
      const recordDate = typeof record.reminder_date === 'string' 
        ? record.reminder_date.split('T')[0] 
        : record.reminder_date
      return recordDate === todayDateString
    })
    
    return found

  } catch (error) {
    return false
  }
}

/**
 * 오늘 일기 리마인더 표시 기록
 * @param {string} [userId] - 사용자 ID (옵셔널, 없으면 자동으로 가져옴)
 * @returns {Promise<void>}
 */
export async function markDiaryReminderShown(userId = null) {
  if (!userId) {
    userId = await getCurrentUserId()
  }
  if (!userId) {
    return
  }

  try {
    const today = new Date()
    const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const { error } = await supabase
      .from('diary_reminders')
      .upsert({
        user_id: userId,
        reminder_date: todayDateString,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,reminder_date',
        ignoreDuplicates: false, // 중복 시 업데이트
      })

    if (error) {
      // 406 에러는 RLS 정책 문제일 수 있음 - 조용히 처리
      if (error.status === 406 || error.code === 'PGRST116') {
        return
      }
      // 다른 에러는 재시도하지 않고 조용히 처리
      return
    }
  } catch (error) {
    // 예외 발생 시에도 조용히 처리 (앱이 계속 동작하도록)
  }
}

