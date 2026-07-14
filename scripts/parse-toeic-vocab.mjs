/**
 * 토익 노랭이 PDF 추출 텍스트 → Day별 JSON 변환
 * Usage: node scripts/parse-toeic-vocab.mjs
 *
 * PDF는 Day당 3열(번호·영어·한글) 레이아웃입니다.
 * 줄 단위로 파싱해야 3열 전체가 들어옵니다.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFParse } from 'pdf-parse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const pdfPath = path.join(root, 'tmp-toeic-vocab.pdf')
const outPath = path.join(root, 'src', 'data', 'toeicNorangiVocab.json')

const parser = new PDFParse({ data: fs.readFileSync(pdfPath) })
const result = await parser.getText()
const text = result.text

/** @type {Map<number, {id:number, en:string, ko:string}[]>} */
const dayMap = new Map()

const pages = text.split(/--\s*(\d+)\s+of\s+30\s*--/)
const pageContents = []
if (pages[0]?.trim()) {
  pageContents.push({ day: 1, content: pages[0] })
}
for (let i = 1; i < pages.length; i += 2) {
  const pageNum = Number(pages[i])
  const content = pages[i + 1] || ''
  const day = pageNum + 1
  if (day <= 30 && content.trim()) {
    pageContents.push({ day, content })
  }
}

/**
 * 한 줄에서 `번호 \t 영어 \t 한글` 삼조를 모두 추출
 * @param {string} content
 * @returns {{id:number, en:string, ko:string}[]}
 */
function parseWords(content) {
  const cleaned = content.replace(/DAY\d+/gi, '').replace(/\r/g, '')
  /** @type {{id:number, en:string, ko:string}[]} */
  const words = []
  const seen = new Set()

  for (const line of cleaned.split('\n')) {
    if (!line.includes('\t')) continue
    if (/--\s*\d+\s+of\s+30/.test(line)) continue

    const re =
      /(\d+)\s*\t\s*([^\t]+?)\s*\t\s*([^\t]+?)(?=\s+\d+\s*\t|\s*$)/g
    let m
    while ((m = re.exec(line)) !== null) {
      const id = Number(m[1])
      const en = m[2].replace(/\s+/g, ' ').trim()
      const ko = m[3].replace(/\s+/g, ' ').trim()
      if (!Number.isFinite(id) || id <= 0) continue
      if (!en || !ko) continue
      if (/^--/.test(en) || /^DAY/i.test(en) || /^\d+$/.test(en)) continue
      if (/^\d+$/.test(ko) || /^--/.test(ko)) continue

      const key = `${id}::${en.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      words.push({ id, en, ko })
    }
  }

  words.sort((a, b) => a.id - b.id)
  return words
}

for (const page of pageContents) {
  const words = parseWords(page.content)
  if (!dayMap.has(page.day)) dayMap.set(page.day, [])
  const list = dayMap.get(page.day)
  const existingKeys = new Set(list.map((w) => `${w.id}::${w.en.toLowerCase()}`))
  for (const w of words) {
    const key = `${w.id}::${w.en.toLowerCase()}`
    if (!existingKeys.has(key)) {
      list.push(w)
      existingKeys.add(key)
    }
  }
}

const days = [...dayMap.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([day, words]) => ({
    day,
    words: words.sort((a, b) => a.id - b.id),
  }))

const payload = {
  source: '토익 노랭이 단어모음',
  dayCount: days.length,
  wordCount: days.reduce((sum, d) => sum + d.words.length, 0),
  days,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8')

console.log(
  JSON.stringify(
    {
      dayCount: payload.dayCount,
      wordCount: payload.wordCount,
      perDay: days.map((d) => ({
        day: d.day,
        n: d.words.length,
        maxId: d.words.at(-1)?.id ?? 0,
        sample: d.words[0],
      })),
    },
    null,
    2,
  ),
)
