import { supabase } from '../config/supabase.js'

/**
 * Day별 완료 횟수 전체 조회
 * @returns {Promise<Record<string, number>>}
 */
export async function getToeicDayCompletions() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('toeic_vocab_day_completions')
    .select('day_number, completion_count')
    .eq('user_id', user.id)

  if (error) throw error

  /** @type {Record<string, number>} */
  const map = {}
  for (const row of data || []) {
    map[String(row.day_number)] = Math.max(0, Number(row.completion_count) || 0)
  }
  return map
}

/**
 * Day 완료 횟수 설정 (upsert)
 * @param {number} dayNumber
 * @param {number} completionCount
 * @returns {Promise<number>}
 */
export async function setToeicDayCompletion(dayNumber, completionCount) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const count = Math.max(0, Math.floor(Number(completionCount) || 0))

  if (count <= 0) {
    const { error } = await supabase
      .from('toeic_vocab_day_completions')
      .delete()
      .eq('user_id', user.id)
      .eq('day_number', dayNumber)
    if (error) throw error
    return 0
  }

  const { data, error } = await supabase
    .from('toeic_vocab_day_completions')
    .upsert(
      {
        user_id: user.id,
        day_number: dayNumber,
        completion_count: count,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,day_number' },
    )
    .select('completion_count')
    .single()

  if (error) throw error
  return Math.max(0, Number(data?.completion_count) || count)
}

/**
 * Day 완료 +1
 * @param {number} dayNumber
 * @returns {Promise<number>}
 */
export async function incrementToeicDayCompletion(dayNumber) {
  const map = await getToeicDayCompletions()
  const next = (map[String(dayNumber)] || 0) + 1
  return setToeicDayCompletion(dayNumber, next)
}

/**
 * Day 완료 -1
 * @param {number} dayNumber
 * @returns {Promise<number>}
 */
export async function decrementToeicDayCompletion(dayNumber) {
  const map = await getToeicDayCompletions()
  const next = Math.max(0, (map[String(dayNumber)] || 0) - 1)
  return setToeicDayCompletion(dayNumber, next)
}

/**
 * 챌린지 목표 조회
 * @returns {Promise<string>}
 */
export async function getToeicChallengeGoal() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('toeic_vocab_challenge_goals')
    .select('goal')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  return data?.goal ?? ''
}

/**
 * 챌린지 목표 저장
 * @param {string} goal
 * @returns {Promise<string>}
 */
export async function setToeicChallengeGoal(goal) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const value = String(goal ?? '')
  const { data, error } = await supabase
    .from('toeic_vocab_challenge_goals')
    .upsert(
      {
        user_id: user.id,
        goal: value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('goal')
    .single()

  if (error) throw error
  return data?.goal ?? value
}
