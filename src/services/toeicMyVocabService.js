import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/** @typedef {{ id: string, en: string, ko: string, checks: number }} MyVocabWord */

/**
 * @param {object} row
 * @returns {MyVocabWord}
 */
function normalizeRow(row) {
  return {
    id: row.id,
    en: row.en,
    ko: row.ko,
    checks: Math.min(3, Math.max(0, Number(row.checks) || 0)),
  }
}

/**
 * 나만의 단어장 목록 조회
 * @returns {Promise<MyVocabWord[]>}
 */
export async function getMyVocabWords() {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { data, error } = await supabase
    .from('toeic_my_vocab_words')
    .select('id, en, ko, checks')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    console.error('나만의 단어장 조회 오류:', error)
    throw error
  }

  return (data || []).map(normalizeRow)
}

/**
 * 단어 추가
 * @param {{ en: string, ko: string }} payload
 * @returns {Promise<MyVocabWord>}
 */
export async function createMyVocabWord(payload) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const en = (payload.en || '').trim()
  const ko = (payload.ko || '').trim()
  if (!en || !ko) throw new Error('영어와 한글을 모두 입력해주세요.')

  const { data: lastRow } = await supabase
    .from('toeic_my_vocab_words')
    .select('sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextSort = (lastRow?.sort_order ?? -1) + 1

  const { data, error } = await supabase
    .from('toeic_my_vocab_words')
    .insert([
      {
        user_id: userId,
        en,
        ko,
        checks: 0,
        sort_order: nextSort,
        created_at: Date.now(),
      },
    ])
    .select('id, en, ko, checks')
    .single()

  if (error) {
    console.error('나만의 단어장 추가 오류:', error)
    throw error
  }

  return normalizeRow(data)
}

/**
 * 체크 횟수 수정
 * @param {string} id
 * @param {number} checks 0–3
 * @returns {Promise<MyVocabWord>}
 */
export async function updateMyVocabWordChecks(id, checks) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const safeChecks = Math.min(3, Math.max(0, Math.floor(Number(checks) || 0)))

  const { data, error } = await supabase
    .from('toeic_my_vocab_words')
    .update({ checks: safeChecks })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, en, ko, checks')
    .single()

  if (error) {
    console.error('나만의 단어장 수정 오류:', error)
    throw error
  }

  return normalizeRow(data)
}

/**
 * 단어 삭제
 * @param {string} id
 */
export async function deleteMyVocabWord(id) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const { error } = await supabase
    .from('toeic_my_vocab_words')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('나만의 단어장 삭제 오류:', error)
    throw error
  }
}

/**
 * localStorage 등 레거시 데이터 일괄 이전
 * @param {Array<{ en: string, ko: string, checks?: number }>} words
 * @returns {Promise<MyVocabWord[]>}
 */
export async function importMyVocabWords(words) {
  const userId = await getCurrentUserId()
  if (!userId) throw new Error('로그인이 필요합니다.')

  const list = (words || []).filter((w) => w?.en?.trim() && w?.ko?.trim())
  if (list.length === 0) return []

  const now = Date.now()
  const rows = list.map((word, index) => ({
    user_id: userId,
    en: word.en.trim(),
    ko: word.ko.trim(),
    checks: Math.min(3, Math.max(0, Number(word.checks) || 0)),
    sort_order: index,
    created_at: now + index,
  }))

  const { data, error } = await supabase
    .from('toeic_my_vocab_words')
    .insert(rows)
    .select('id, en, ko, checks')

  if (error) {
    console.error('나만의 단어장 이전 오류:', error)
    throw error
  }

  return (data || []).map(normalizeRow)
}
