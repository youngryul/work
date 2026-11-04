/**
 * 오늘 할 일 보기 설정 서비스 (user_preferences 테이블)
 * DB가 원본이고, 시간대 계산은 동기로 해야 해서 localStorage에 캐시해 둠
 */
import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import {
  TIME_SLOT_VIEW_STORAGE_KEY,
  TIME_SLOT_FOCUS_STORAGE_KEY,
  TIME_SLOT_AUTO_CARRY_STORAGE_KEY,
  getTimeSlotTimes,
  isValidTimeSlotTimes,
  saveTimeSlotTimes,
} from '../constants/timeSlots.js'

const TODAY_VIEW_COLUMNS = [
  'today_time_slot_view',
  'today_time_slot_focus',
  'time_slot_morning_minutes',
  'time_slot_afternoon_minutes',
  'time_slot_evening_minutes',
  'today_time_slot_auto_carry',
].join(', ')

/**
 * localStorage boolean 읽기 (실패 시 기본값)
 * @param {string} key
 */
function readCachedFlag(key) {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

/**
 * 캐시(localStorage)에 있는 보기 설정 — 화면을 바로 그릴 때 사용
 * @returns {{ isSlotView: boolean, isFocusMode: boolean, isAutoCarry: boolean, times: { morning: number, afternoon: number, evening: number } }}
 */
export function getCachedTodayViewSettings() {
  return {
    isSlotView: readCachedFlag(TIME_SLOT_VIEW_STORAGE_KEY),
    isFocusMode: readCachedFlag(TIME_SLOT_FOCUS_STORAGE_KEY),
    isAutoCarry: readCachedFlag(TIME_SLOT_AUTO_CARRY_STORAGE_KEY),
    times: getTimeSlotTimes(),
  }
}

/**
 * 보기 설정을 캐시에 반영 (시간대 시각이 바뀌면 변경 이벤트 발생)
 * @param {{ isSlotView: boolean, isFocusMode: boolean, isAutoCarry: boolean, times: object }} settings
 */
function cacheTodayViewSettings(settings) {
  try {
    localStorage.setItem(TIME_SLOT_VIEW_STORAGE_KEY, String(settings.isSlotView))
    localStorage.setItem(TIME_SLOT_FOCUS_STORAGE_KEY, String(settings.isFocusMode))
    localStorage.setItem(TIME_SLOT_AUTO_CARRY_STORAGE_KEY, String(settings.isAutoCarry))
  } catch {
    // 캐시 실패해도 DB 값은 유지
  }
  if (isValidTimeSlotTimes(settings.times)) {
    saveTimeSlotTimes(settings.times)
  }
}

/**
 * user_preferences 행 → 보기 설정 (값이 비어 있으면 캐시 값 사용)
 * @param {Object} row
 */
function toTodayViewSettings(row) {
  const cached = getCachedTodayViewSettings()
  const times = {
    morning: row.time_slot_morning_minutes,
    afternoon: row.time_slot_afternoon_minutes,
    evening: row.time_slot_evening_minutes,
  }
  return {
    isSlotView: row.today_time_slot_view ?? cached.isSlotView,
    isFocusMode: row.today_time_slot_focus ?? cached.isFocusMode,
    isAutoCarry: row.today_time_slot_auto_carry ?? cached.isAutoCarry,
    times: isValidTimeSlotTimes(times) ? times : cached.times,
  }
}

/**
 * 보기 설정 조회 (DB → 캐시 갱신)
 * DB에 저장된 적이 없거나 조회에 실패하면 캐시 값을 그대로 돌려줌
 * @returns {Promise<{ isSlotView: boolean, isFocusMode: boolean, isAutoCarry: boolean, times: object }>}
 */
export async function loadTodayViewSettings() {
  const cached = getCachedTodayViewSettings()
  const userId = await getCurrentUserId()
  if (!userId) return cached

  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select(TODAY_VIEW_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    if (!data) return cached

    const settings = toTodayViewSettings(data)
    cacheTodayViewSettings(settings)
    return settings
  } catch (error) {
    // 마이그레이션 전(컬럼 없음) 등: 캐시 값으로 계속 동작
    console.error('오늘 할 일 보기 설정 조회 오류:', error)
    return cached
  }
}

/**
 * 보기 설정 저장 (DB 저장 성공 후 캐시 갱신)
 * @param {{ isSlotView: boolean, isFocusMode: boolean, isAutoCarry: boolean, times: { morning: number, afternoon: number, evening: number } }} settings
 * @returns {Promise<void>}
 */
export async function saveTodayViewSettings(settings) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }
  if (!isValidTimeSlotTimes(settings.times)) {
    throw new Error('오전 < 오후 < 퇴근 후 순서로 시작 시각을 정해주세요.')
  }

  const updateData = {
    today_time_slot_view: !!settings.isSlotView,
    today_time_slot_focus: !!settings.isFocusMode,
    time_slot_morning_minutes: settings.times.morning,
    time_slot_afternoon_minutes: settings.times.afternoon,
    time_slot_evening_minutes: settings.times.evening,
    today_time_slot_auto_carry: !!settings.isAutoCarry,
  }

  // 기존 행 확인 후 update / insert (알림 설정과 같은 방식)
  const { data: existing, error: checkError } = await supabase
    .from('user_preferences')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (checkError) {
    console.error('user_preferences 확인 오류:', checkError)
    throw checkError
  }

  const query = existing
    ? supabase.from('user_preferences').update(updateData).eq('user_id', userId)
    : supabase.from('user_preferences').insert({ user_id: userId, ...updateData })

  const { error } = await query
  if (error) {
    console.error('오늘 할 일 보기 설정 저장 오류:', error)
    throw error
  }

  cacheTodayViewSettings(settings)
}
