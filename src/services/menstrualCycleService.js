import { supabase } from '../config/supabase.js'
import {
  DEFAULT_MENSTRUAL_CYCLE_LENGTH,
  DEFAULT_MENSTRUAL_PERIOD_LENGTH,
  MAX_MENSTRUAL_CYCLE_LENGTH,
  MAX_MENSTRUAL_PERIOD_LENGTH,
  MIN_MENSTRUAL_CYCLE_LENGTH,
  MIN_MENSTRUAL_PERIOD_LENGTH,
} from '../constants/menstrualCycle.js'
import { addDaysToDateKey } from '../utils/menstrualCycleCalendar.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * @param {Object} row
 * @returns {{ userId: string, cycleLength: number, periodLength: number, updatedAt?: string }}
 */
function normalizeSettings(row) {
  return {
    userId: row.user_id,
    cycleLength: row.cycle_length,
    periodLength: row.period_length,
    isEnabled: row.is_enabled,
    onboardingCompleted: row.onboarding_completed,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {Object} row
 * @returns {{ id: string, userId: string, startDate: string, endDate: string, notes?: string | null }}
 */
function normalizePeriodRecord(row) {
  return {
    id: row.id,
    userId: row.user_id,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {number} cycleLength
 * @param {number} periodLength
 */
function assertValidCycleSettings(cycleLength, periodLength) {
  if (
    cycleLength < MIN_MENSTRUAL_CYCLE_LENGTH ||
    cycleLength > MAX_MENSTRUAL_CYCLE_LENGTH
  ) {
    throw new Error(`생리 주기는 ${MIN_MENSTRUAL_CYCLE_LENGTH}~${MAX_MENSTRUAL_CYCLE_LENGTH}일 사이여야 합니다.`)
  }
  if (
    periodLength < MIN_MENSTRUAL_PERIOD_LENGTH ||
    periodLength > MAX_MENSTRUAL_PERIOD_LENGTH
  ) {
    throw new Error(`생리 기간은 ${MIN_MENSTRUAL_PERIOD_LENGTH}~${MAX_MENSTRUAL_PERIOD_LENGTH}일 사이여야 합니다.`)
  }
  if (periodLength >= cycleLength) {
    throw new Error('생리 기간은 주기보다 짧아야 합니다.')
  }
}

/**
 * @returns {Promise<{ cycleLength: number, periodLength: number }>}
 */
export async function getMenstrualCycleSettings() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return {
      cycleLength: DEFAULT_MENSTRUAL_CYCLE_LENGTH,
      periodLength: DEFAULT_MENSTRUAL_PERIOD_LENGTH,
      isEnabled: false,
      onboardingCompleted: true,
    }
  }

  const { data, error } = await supabase
    .from('menstrual_cycle_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('생리 주기 설정 조회 실패:', error)
    throw error
  }

  if (!data) {
    return {
      cycleLength: DEFAULT_MENSTRUAL_CYCLE_LENGTH,
      periodLength: DEFAULT_MENSTRUAL_PERIOD_LENGTH,
      isEnabled: true,
      onboardingCompleted: false,
    }
  }

  return normalizeSettings(data)
}

/**
 * @param {{ cycleLength: number, periodLength: number }} settings
 * @returns {Promise<{ cycleLength: number, periodLength: number }>}
 */
export async function saveMenstrualCycleSettings(settings) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const cycleLength = Number(settings.cycleLength)
  const periodLength = Number(settings.periodLength)
  assertValidCycleSettings(cycleLength, periodLength)
  const current = await getMenstrualCycleSettings()

  const { data, error } = await supabase
    .from('menstrual_cycle_settings')
    .upsert(
      {
        user_id: userId,
        cycle_length: cycleLength,
        period_length: periodLength,
        is_enabled: current.isEnabled,
        onboarding_completed: current.onboardingCompleted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single()

  if (error) {
    console.error('생리 주기 설정 저장 실패:', error)
    throw error
  }

  return normalizeSettings(data)
}

/**
 * @param {boolean} isEnabled
 * @returns {Promise<{ cycleLength: number, periodLength: number, isEnabled: boolean, onboardingCompleted: boolean }>}
 */
export async function saveMenstrualFeaturePreference(isEnabled) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const current = await getMenstrualCycleSettings()
  const { data, error } = await supabase
    .from('menstrual_cycle_settings')
    .upsert(
      {
        user_id: userId,
        cycle_length: current.cycleLength,
        period_length: current.periodLength,
        is_enabled: Boolean(isEnabled),
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single()

  if (error) {
    console.error('생리 기능 사용 설정 저장 실패:', error)
    throw error
  }

  return normalizeSettings(data)
}

/**
 * @param {string} rangeStart - YYYY-MM-DD
 * @param {string} rangeEnd - YYYY-MM-DD
 * @returns {Promise<Array<{ id: string, startDate: string, endDate: string }>>}
 */
export async function getPeriodRecordsInRange(rangeStart, rangeEnd) {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('menstrual_period_records')
    .select('*')
    .eq('user_id', userId)
    .lte('start_date', rangeEnd)
    .gte('end_date', rangeStart)
    .order('start_date', { ascending: false })

  if (error) {
    console.error('생리 기록 조회 실패:', error)
    throw error
  }

  return (data || []).map(normalizePeriodRecord)
}

/**
 * @param {string} startDate - YYYY-MM-DD
 * @returns {Promise<object>}
 */
export async function recordPeriodStart(startDate) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')
  if (!startDate) throw new Error('시작일을 선택해주세요.')

  const settings = await getMenstrualCycleSettings()
  const endDate = addDaysToDateKey(startDate, settings.periodLength - 1)

  const { data, error } = await supabase
    .from('menstrual_period_records')
    .insert({
      user_id: userId,
      start_date: startDate,
      end_date: endDate,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('이미 등록된 생리 시작일입니다.')
    }
    console.error('생리 시작일 기록 실패:', error)
    throw error
  }

  return normalizePeriodRecord(data)
}

/**
 * @param {string} recordId
 * @returns {Promise<boolean>}
 */
export async function deletePeriodRecord(recordId) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('menstrual_period_records')
    .delete()
    .eq('id', recordId)
    .eq('user_id', userId)

  if (error) {
    console.error('생리 기록 삭제 실패:', error)
    throw error
  }

  return true
}
