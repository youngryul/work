/**
 * src/data/toeicNorangiVocab.json → Supabase toeic_vocab_catalog 업로드
 *
 * 필요 환경 변수:
 *   VITE_SUPABASE_URL (또는 SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: node scripts/seed-toeic-vocab-catalog.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const jsonPath = path.join(root, 'src', 'data', 'toeicNorangiVocab.json')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.')
  process.exit(1)
}

const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
const allWords = (raw.days ?? []).flatMap((day) => day.words ?? [])

if (allWords.length === 0) {
  console.error('업로드할 단어가 없습니다.')
  process.exit(1)
}

const rows = allWords.map((word, index) => ({
  sort_order: index + 1,
  en: String(word.en).trim(),
  ko: String(word.ko).trim(),
}))

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const BATCH = 500
console.log(`총 ${rows.length}개 단어 업로드 시작...`)

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH)
  const { error } = await supabase
    .from('toeic_vocab_catalog')
    .upsert(batch, { onConflict: 'sort_order' })

  if (error) {
    console.error('업로드 실패:', error.message)
    process.exit(1)
  }
  console.log(`  ${Math.min(i + BATCH, rows.length)} / ${rows.length}`)
}

console.log('완료.')
