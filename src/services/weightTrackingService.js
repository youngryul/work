/**
 * 몸무게 기록 서비스
 */
import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'
import { WEIGHT_GOAL_TOLERANCE_KG } from '../constants/weightTracking.js'
import {
  awardJellyForWeightGoalReached,
  awardJellyForWeightRecord,
} from './jellyService.js'

/**
 * @param {Object} row
 * @returns {Object}
 */
function normalizeWeightRecord(row) {
  return {
    id: row.id,
    userId: row.user_id,
    recordDate: row.record_date,
    weightKg: Number(row.weight_kg),
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * @param {Object|null} row
 * @returns {Object|null}
 */
function normalizeWeightGoal(row) {
  if (!row) return null
  return {
    userId: row.user_id,
    targetWeightKg: Number(row.target_weight_kg),
    targetDate: row.target_date || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 최신 몸무게를 user_preferences에 동기화 (칼로리 계산 연동)
 * @param {number} weightKg
 */
async function syncUserPreferencesWeight(weightKg) {
  const userId = await getCurrentUserId()
  if (!userId) return

  try {
    const { data: existing } = await supabase
      .from('user_preferences')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('user_preferences')
        .update({ weight: weightKg })
        .eq('user_id', userId)
    } else {
      await supabase.from('user_preferences').insert({
        user_id: userId,
        weight: weightKg,
      })
    }
  } catch (error) {
    console.warn('user_preferences 몸무게 동기화 실패 (무시됨):', error)
  }
}

/**
 * 목표 달성 여부 확인 후 젤리 지급
 * @param {number} currentWeightKg
 * @param {Object|null} goal
 * @returns {Promise<number>} 지급된 젤리
 */
async function tryAwardGoalReachedJelly(currentWeightKg, goal) {
  if (!goal?.targetWeightKg) return 0

  const diff = Math.abs(currentWeightKg - goal.targetWeightKg)
  if (diff > WEIGHT_GOAL_TOLERANCE_KG) return 0

  const goalKey = `${goal.targetWeightKg}:${goal.targetDate || 'none'}`
  try {
    const result = await awardJellyForWeightGoalReached(goalKey)
    return result?.awarded ?? 0
  } catch (error) {
    console.error('목표 달성 젤리 지급 실패:', error)
    return 0
  }
}

/**
 * 몸무게 기록 저장 (같은 날짜면 업데이트)
 * @param {{ recordDate: string, weightKg: number, notes?: string }} recordData
 * @returns {Promise<{ record: Object, jellyAwarded: number, goalJellyAwarded: number }>}
 */
export async function saveWeightRecord(recordData) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const recordDate = recordData.recordDate || new Date().toISOString().split('T')[0]
  const weightKg = Number(recordData.weightKg)

  if (!weightKg || weightKg <= 0) {
    throw new Error('올바른 몸무게를 입력해주세요.')
  }

  const { data: existing } = await supabase
    .from('weight_records')
    .select('id')
    .eq('user_id', userId)
    .eq('record_date', recordDate)
    .maybeSingle()

  let data
  let error

  if (existing) {
    ;({ data, error } = await supabase
      .from('weight_records')
      .update({
        weight_kg: weightKg,
        notes: recordData.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('user_id', userId)
      .select()
      .single())
  } else {
    ;({ data, error } = await supabase
      .from('weight_records')
      .insert({
        user_id: userId,
        record_date: recordDate,
        weight_kg: weightKg,
        notes: recordData.notes?.trim() || null,
      })
      .select()
      .single())
  }

  if (error) {
    console.error('몸무게 기록 저장 오류:', error)
    throw new Error(`몸무게 기록 저장 실패: ${error.message}`)
  }

  await syncUserPreferencesWeight(weightKg)

  let jellyAwarded = 0
  try {
    const jellyResult = await awardJellyForWeightRecord(recordDate)
    jellyAwarded = jellyResult?.awarded ?? 0
  } catch (jellyError) {
    console.error('젤리 지급 실패:', jellyError)
  }

  const goal = await getWeightGoal()
  let goalJellyAwarded = 0
  if (goal) {
    goalJellyAwarded = await tryAwardGoalReachedJelly(weightKg, goal)
  }

  return {
    record: normalizeWeightRecord(data),
    jellyAwarded,
    goalJellyAwarded,
  }
}

/**
 * 몸무게 기록 목록 조회
 * @param {{ startDate?: string, endDate?: string, limit?: number }} [options]
 */
export async function getWeightRecords(options = {}) {
  const userId = await getCurrentUserId()
  if (!userId) return []

  let query = supabase
    .from('weight_records')
    .select('*')
    .eq('user_id', userId)

  if (options.startDate) {
    query = query.gte('record_date', options.startDate)
  }
  if (options.endDate) {
    query = query.lte('record_date', options.endDate)
  }

  query = query.order('record_date', { ascending: false })

  if (options.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('몸무게 기록 조회 오류:', error)
    throw new Error(`몸무게 기록 조회 실패: ${error.message}`)
  }

  return (data || []).map(normalizeWeightRecord)
}

/**
 * 최신 몸무게 기록 조회
 */
export async function getLatestWeightRecord() {
  const records = await getWeightRecords({ limit: 1 })
  return records[0] || null
}

/**
 * 몸무게 기록 삭제
 * @param {string} recordId
 */
export async function deleteWeightRecord(recordId) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const { error } = await supabase
    .from('weight_records')
    .delete()
    .eq('id', recordId)
    .eq('user_id', userId)

  if (error) {
    console.error('몸무게 기록 삭제 오류:', error)
    throw new Error(`몸무게 기록 삭제 실패: ${error.message}`)
  }
}

/**
 * 목표 몸무게 조회
 */
export async function getWeightGoal() {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const { data, error } = await supabase
    .from('weight_goals')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('목표 몸무게 조회 오류:', error)
    return null
  }

  return normalizeWeightGoal(data)
}

/**
 * 목표 몸무게 저장
 * @param {{ targetWeightKg: number, targetDate?: string|null }} goalData
 */
export async function saveWeightGoal(goalData) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  const targetWeightKg = Number(goalData.targetWeightKg)
  if (!targetWeightKg || targetWeightKg <= 0) {
    throw new Error('올바른 목표 몸무게를 입력해주세요.')
  }

  const { data: existing } = await supabase
    .from('weight_goals')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  const payload = {
    target_weight_kg: targetWeightKg,
    target_date: goalData.targetDate || null,
    updated_at: new Date().toISOString(),
  }

  let data
  let error

  if (existing) {
    ;({ data, error } = await supabase
      .from('weight_goals')
      .update(payload)
      .eq('user_id', userId)
      .select()
      .single())
  } else {
    ;({ data, error } = await supabase
      .from('weight_goals')
      .insert({
        user_id: userId,
        ...payload,
      })
      .select()
      .single())
  }

  if (error) {
    console.error('목표 몸무게 저장 오류:', error)
    throw new Error(`목표 몸무게 저장 실패: ${error.message}`)
  }

  return normalizeWeightGoal(data)
}

/**
 * 기간별 몸무게 요약
 * @param {string} startDate
 * @param {string} endDate
 */
export async function getWeightSummary(startDate, endDate) {
  const records = await getWeightRecords({ startDate, endDate })
  if (records.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      avg: null,
      change: null,
      latest: null,
      earliest: null,
    }
  }

  const sorted = [...records].sort((a, b) => a.recordDate.localeCompare(b.recordDate))
  const weights = sorted.map((r) => r.weightKg)
  const sum = weights.reduce((acc, w) => acc + w, 0)

  return {
    count: records.length,
    min: Math.min(...weights),
    max: Math.max(...weights),
    avg: Math.round((sum / weights.length) * 10) / 10,
    change: Math.round((weights[weights.length - 1] - weights[0]) * 10) / 10,
    latest: sorted[sorted.length - 1],
    earliest: sorted[0],
  }
}

/**
 * 목표 대비 진행률 계산
 * @param {number|null} currentWeight
 * @param {number|null} targetWeight
 * @param {number|null} startWeight
 * @returns {number} 0~100
 */
export function calculateGoalProgress(currentWeight, targetWeight, startWeight) {
  if (!currentWeight || !targetWeight || !startWeight) return 0
  if (startWeight === targetWeight) {
    return Math.abs(currentWeight - targetWeight) <= WEIGHT_GOAL_TOLERANCE_KG ? 100 : 0
  }

  const totalDelta = targetWeight - startWeight
  const currentDelta = currentWeight - startWeight
  const progress = (currentDelta / totalDelta) * 100
  return Math.max(0, Math.min(100, Math.round(progress)))
}

/**
 * N일 전 날짜 (YYYY-MM-DD)
 * @param {number} days
 */
export function getDateDaysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}
