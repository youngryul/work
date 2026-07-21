import { supabase } from '../config/supabase.js'
import { regroupVocabByDaySize, WORDS_PER_DAY } from '../utils/toeicVocabDays.js'

const CATALOG_PAGE_SIZE = 1000
const DEFAULT_SOURCE_LABEL = '토익 노랭이 단어모음'

/**
 * Supabase 카탈로그 전체 조회 후 Day 구조로 변환
 * @returns {Promise<import('../utils/toeicVocabDays.js').VocabData>}
 */
export async function getToeicVocabCatalog() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  /** @type {Array<{ sort_order: number, en: string, ko: string }>} */
  const rows = []
  let from = 0

  while (true) {
    const to = from + CATALOG_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('toeic_vocab_catalog')
      .select('sort_order, en, ko')
      .order('sort_order', { ascending: true })
      .range(from, to)

    if (error) {
      console.error('토익 카탈로그 조회 오류:', error)
      throw error
    }

    const chunk = data || []
    rows.push(...chunk)
    if (chunk.length < CATALOG_PAGE_SIZE) break
    from += CATALOG_PAGE_SIZE
  }

  if (rows.length === 0) {
    return {
      source: DEFAULT_SOURCE_LABEL,
      dayCount: 0,
      wordCount: 0,
      days: [],
    }
  }

  const flatDays = [
    {
      day: 1,
      words: rows.map((row, index) => ({
        id: index + 1,
        en: row.en,
        ko: row.ko,
      })),
    },
  ]

  return regroupVocabByDaySize(
    {
      source: DEFAULT_SOURCE_LABEL,
      dayCount: flatDays.length,
      wordCount: rows.length,
      days: flatDays,
    },
    WORDS_PER_DAY,
  )
}
