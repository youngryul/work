/**
 * 알림 설정 관리 서비스
 */
import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/** 설정이 없을 때 기본값 (모두 켜짐) */
const DEFAULT_NOTIFICATION_SETTINGS = {
  diaryEnabled: true,
  weeklySummaryEnabled: true,
  monthlySummaryEnabled: true,
  fiveYearQuestionEnabled: true,
  backlogStaleEnabled: true,
}

const NOTIFICATION_COLUMNS = [
  'notification_diary_enabled',
  'notification_weekly_summary_enabled',
  'notification_monthly_summary_enabled',
  'notification_five_year_question_enabled',
  'notification_backlog_stale_enabled',
].join(', ')

/**
 * user_preferences 행 → 알림 설정 객체
 * @param {Object|null} data
 */
function toNotificationSettings(data) {
  return {
    diaryEnabled: data?.notification_diary_enabled ?? true,
    weeklySummaryEnabled: data?.notification_weekly_summary_enabled ?? true,
    monthlySummaryEnabled: data?.notification_monthly_summary_enabled ?? true,
    fiveYearQuestionEnabled: data?.notification_five_year_question_enabled ?? true,
    backlogStaleEnabled: data?.notification_backlog_stale_enabled ?? true,
  }
}

/**
 * 알림 설정 조회
 * @returns {Promise<Object>} 알림 설정
 */
export async function getNotificationSettings() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { ...DEFAULT_NOTIFICATION_SETTINGS }
  }

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select(NOTIFICATION_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('알림 설정 조회 오류:', error)
      throw error
    }

    return toNotificationSettings(data)
  } catch (error) {
    console.error('알림 설정 조회 오류:', error)
    // 오류 발생 시 기본값 반환
    return { ...DEFAULT_NOTIFICATION_SETTINGS }
  }
}

/**
 * 알림 설정 저장
 * @param {Object} settings - 알림 설정
 * @returns {Promise<Object>} 저장된 설정
 */
export async function saveNotificationSettings(settings) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    // 기존 설정 확인
    const { data: existing, error: checkError } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('user_preferences 확인 오류:', checkError)
      throw checkError
    }

    const updateData = {
      notification_diary_enabled: settings.diaryEnabled ?? true,
      notification_weekly_summary_enabled: settings.weeklySummaryEnabled ?? true,
      notification_monthly_summary_enabled: settings.monthlySummaryEnabled ?? true,
      notification_five_year_question_enabled: settings.fiveYearQuestionEnabled ?? true,
      notification_backlog_stale_enabled: settings.backlogStaleEnabled ?? true,
    }

    const query = existing
      ? supabase.from('user_preferences').update(updateData).eq('user_id', userId)
      : supabase.from('user_preferences').insert({ user_id: userId, ...updateData })

    const { data, error } = await query.select().single()

    if (error) {
      console.error('알림 설정 저장 오류:', error)
      throw error
    }

    return toNotificationSettings(data)
  } catch (error) {
    console.error('알림 설정 저장 오류:', error)
    throw error
  }
}
