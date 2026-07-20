import { useState, useCallback } from 'react'
import { showToast, TOAST_TYPES } from './Toast.jsx'

const STORAGE_KEY = 'toeic-my-vocab-v1'

/** @returns {Array<{id:string, en:string, ko:string, checks:number}>} */
function loadWords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveWords(words) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words))
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sproutSvg() {
  return `<svg class="deco-sprout" viewBox="0 0 48 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="24" cy="48" rx="14" ry="6" fill="#8B6914"/>
    <path d="M24 46 V22" stroke="#2F6B2F" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M24 30 C14 28 10 18 16 12 C22 18 24 24 24 30Z" fill="#6BBF4A"/>
    <path d="M24 28 C32 24 38 16 34 10 C28 14 22 22 24 28Z" fill="#5AAE3C"/>
  </svg>`
}

/** 인쇄: checks < 3인 단어만 출력 */
async function printMyVocab(words) {
  const printWords = words.filter((w) => w.checks < 3)
  if (printWords.length === 0) {
    showToast('인쇄할 단어가 없습니다 (모두 3회 체크 완료)', TOAST_TYPES.INFO)
    return
  }

  // 포실이 이미지 로드
  const imgSrc = `${window.location.origin}/images/포실이.png`
  let posiriDataUrl = imgSrc
  try {
    const res = await fetch(imgSrc)
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = objUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] <= 28 && data[i + 1] <= 28 && data[i + 2] <= 28) data[i + 3] = 0
    }
    ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0)
    posiriDataUrl = canvas.toDataURL('image/png')
    URL.revokeObjectURL(objUrl)
  } catch {
    // 이미지 로드 실패 시 원본 사용
  }

  const WORDS_PER_PAGE = 30
  const pages = []
  for (let i = 0; i < printWords.length; i += WORDS_PER_PAGE) {
    const slice = printWords.slice(i, i + WORDS_PER_PAGE)
    while (slice.length < WORDS_PER_PAGE) slice.push(null)
    pages.push(slice)
  }

  const sheetsHtml = pages
    .map((pageWords, pageIndex) => {
      const rows = pageWords
        .map((word, i) => {
          const num = pageIndex * WORDS_PER_PAGE + i + 1
          return `<tr>
            <td class="col-no">${word ? num : ''}</td>
            <td class="col-en">${word ? escapeHtml(word.en) : ''}</td>
            <td class="col-ko">${word ? escapeHtml(word.ko) : ''}</td>
          </tr>`
        })
        .join('')
      return `
      <section class="sheet">
        <header class="sheet-header">
          <div class="header-left">
            <img class="mascot" src="${posiriDataUrl}" alt="포실이" />
            <div class="grass"></div>
          </div>
          <div class="header-center">
            <h1 class="sheet-title">나만의 포실이 단어장<span class="title-line"></span></h1>
            <div class="meta-fields">
              <div class="meta-date">
                <span class="meta-label">DATE</span>
                <span class="meta-colon">:</span>
                <span class="date-blanks">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
              </div>
            </div>
          </div>
          <div class="header-right">
            ${sproutSvg()}
            <span class="page-num">${pageIndex + 1}/${pages.length}</span>
          </div>
        </header>
        <table class="vocab-table">
          <thead><tr><th class="col-no">No.</th><th class="col-en">영어 단어</th><th class="col-ko">뜻</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`
    })
    .join('')

  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/>
<title>나만의 포실이 단어장</title>
<style>
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:#fff;font-family:'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.sheet{width:190mm;min-height:277mm;margin:0 auto;padding:8mm 8mm 6mm;page-break-after:always;break-after:page;display:flex;flex-direction:column;gap:5mm;background:#faf7f0;}
.sheet:last-child{page-break-after:auto;break-after:auto;}
.sheet-header{display:grid;grid-template-columns:32mm 1fr 22mm;gap:3mm;align-items:flex-start;}
.header-left{display:flex;flex-direction:column;align-items:center;}
.mascot{width:28mm;height:28mm;object-fit:contain;background:transparent;}
.grass{width:24mm;height:4mm;margin-top:-2mm;background:linear-gradient(180deg,#7cbc4a 0%,#5a9a35 100%);border-radius:40% 40% 30% 30%;opacity:.85;}
.header-center{text-align:center;padding-top:1mm;}
.sheet-title{position:relative;display:inline-block;margin:0;font-size:22px;font-weight:800;letter-spacing:-.02em;color:#1a1a1a;line-height:1.2;}
.title-line{display:block;height:0;margin-top:2mm;border-bottom:2.5px solid #5f9e45;}
.meta-fields{display:flex;justify-content:center;align-items:center;gap:8mm;margin-top:4mm;font-size:12px;font-weight:700;}
.meta-date{display:inline-flex;align-items:center;gap:2mm;}
.meta-label{letter-spacing:.04em;}
.meta-colon{margin:0 .5mm;}
.date-blanks{border-bottom:1.5px solid #222;letter-spacing:1px;font-weight:500;min-width:38mm;text-align:center;}
.header-right{display:flex;flex-direction:column;align-items:flex-end;gap:2mm;}
.deco-sprout{width:14mm;height:16mm;}
.page-num{font-size:9px;color:#777;font-weight:600;}
.vocab-table{width:100%;border-collapse:separate;border-spacing:0;border:2.2px solid #222;border-radius:10px;overflow:hidden;background:#fffef9;flex:1;}
.vocab-table th,.vocab-table td{border-bottom:1.4px solid #222;border-right:1.4px solid #222;padding:0 2mm;font-size:10.5px;height:6.5mm;vertical-align:middle;}
.vocab-table th:last-child,.vocab-table td:last-child{border-right:none;}
.vocab-table tbody tr:last-child td{border-bottom:none;}
.vocab-table thead th{background:#fffef9;font-weight:800;font-size:11px;text-align:center;height:7mm;}
.col-no{width:14mm;text-align:center;font-weight:700;color:#333;}
.col-en{width:42%;font-weight:700;color:#1a1a1a;}
.col-ko{color:#1a1a1a;}
@page{size:A4;margin:8mm;}
@media print{.sheet{width:auto;min-height:auto;margin:0;padding:0;background:#fff;}}
</style></head><body>${sheetsHtml}</body></html>`

  const existing = document.getElementById('my-vocab-print-frame')
  if (existing) existing.remove()
  const iframe = document.createElement('iframe')
  iframe.id = 'my-vocab-print-frame'
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)
  const fw = iframe.contentWindow
  const fd = fw?.document
  if (!fw || !fd) { iframe.remove(); throw new Error('인쇄 프레임 생성 실패') }
  fd.open(); fd.write(html); fd.close()
  await new Promise((r) => setTimeout(r, 120))
  try { fw.focus(); fw.print() } finally {
    setTimeout(() => { if (iframe.parentNode) iframe.remove() }, 800)
  }
}

/** 체크 원 3개 */
function CheckDots({ checks, onToggle }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onToggle(n)}
          title={`${n}회 체크`}
          className={`w-5 h-5 rounded-full border-2 transition-colors ${
            checks >= n
              ? 'bg-sky-500 border-sky-500'
              : 'bg-white border-gray-300 hover:border-sky-300'
          }`}
        />
      ))}
    </div>
  )
}

/**
 * 나만의 단어장 탭
 */
export default function ToeicMyVocabTab() {
  const [words, setWords] = useState(loadWords)
  const [newEn, setNewEn] = useState('')
  const [newKo, setNewKo] = useState('')
  const [isPrinting, setIsPrinting] = useState(false)

  const persist = useCallback((next) => {
    setWords(next)
    saveWords(next)
  }, [])

  const handleAdd = () => {
    const en = newEn.trim()
    const ko = newKo.trim()
    if (!en || !ko) {
      showToast('영어와 한글을 모두 입력해주세요', TOAST_TYPES.ERROR)
      return
    }
    const next = [
      ...words,
      { id: `${Date.now()}-${Math.random()}`, en, ko, checks: 0 },
    ]
    persist(next)
    setNewEn('')
    setNewKo('')
  }

  const handleDelete = (id) => {
    persist(words.filter((w) => w.id !== id))
  }

  /** n번째 원 클릭: checks가 n이면 n-1로, 아니면 n으로 */
  const handleToggleCheck = (id, n) => {
    persist(
      words.map((w) =>
        w.id === id ? { ...w, checks: w.checks === n ? n - 1 : n } : w,
      ),
    )
  }

  const handlePrint = async () => {
    setIsPrinting(true)
    try {
      await printMyVocab(sortedWords)
      showToast('나만의 단어장 — 인쇄 창에서 PDF로 저장하세요', TOAST_TYPES.INFO)
    } catch {
      showToast('인쇄를 열 수 없습니다', TOAST_TYPES.ERROR)
    } finally {
      setIsPrinting(false)
    }
  }

  // checks < 3 먼저, checks === 3은 맨 뒤 (삽입 순서 유지)
  const sortedWords = [
    ...words.filter((w) => w.checks < 3),
    ...words.filter((w) => w.checks >= 3),
  ]

  return (
    <div className="space-y-4">
      {/* 상단 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          총 <span className="font-semibold text-gray-800">{words.length}</span>개
          {words.filter((w) => w.checks >= 3).length > 0 && (
            <span className="ml-1 text-sky-600">
              · 완료 {words.filter((w) => w.checks >= 3).length}개
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={handlePrint}
          disabled={isPrinting || words.filter((w) => w.checks < 3).length === 0}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-40"
        >
          {isPrinting ? '준비 중...' : '🖨️ 단어장 인쇄'}
        </button>
      </div>

      {/* 추가 폼 */}
      <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-sky-50 border border-sky-100">
        <input
          type="text"
          placeholder="영어 단어"
          value={newEn}
          onChange={(e) => setNewEn(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 min-w-[120px] px-3 py-2 text-sm rounded-lg border border-sky-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
        />
        <input
          type="text"
          placeholder="한글 뜻"
          value={newKo}
          onChange={(e) => setNewKo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="flex-1 min-w-[120px] px-3 py-2 text-sm rounded-lg border border-sky-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700"
        >
          + 추가
        </button>
      </div>

      {/* 단어 목록 */}
      {sortedWords.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-10">
          단어를 추가해보세요
        </p>
      ) : (
        <div className="rounded-xl border border-sky-100 bg-white overflow-hidden shadow-sm">
          <div className="max-h-[min(70vh,640px)] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-sky-50 border-b border-sky-100">
                <tr className="text-left text-gray-600">
                  <th className="px-3 py-2.5 w-10 font-semibold">#</th>
                  <th className="px-3 py-2.5 font-semibold">English</th>
                  <th className="px-3 py-2.5 font-semibold">한글</th>
                  <th className="px-3 py-2.5 text-center font-semibold w-28">체크</th>
                  <th className="px-3 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {sortedWords.map((word, index) => {
                  const done = word.checks >= 3
                  return (
                    <tr
                      key={word.id}
                      className={`border-b border-gray-50 ${done ? 'bg-gray-50' : 'hover:bg-sky-50/50'}`}
                    >
                      <td className="px-3 py-2 text-gray-400 tabular-nums">{index + 1}</td>
                      <td className={`px-3 py-2 font-medium ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                        {word.en}
                      </td>
                      <td className={`px-3 py-2 ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {word.ko}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-center">
                          <CheckDots
                            checks={word.checks}
                            onToggle={(n) => handleToggleCheck(word.id, n)}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDelete(word.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors text-base leading-none"
                          title="삭제"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
