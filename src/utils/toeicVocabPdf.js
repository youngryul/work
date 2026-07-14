/**
 * 포실이 영어 단어장 인쇄/PDF (심플 양식)
 * — 페이지당 30단어, No. / 영어 단어 / 뜻
 * — 상단 포실이 이미지(검정 배경 제거)
 */

const WORDS_PER_PAGE = 30
const BLACK_THRESHOLD = 28

/** @type {Map<string, string>} */
const transparentImageCache = new Map()

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * public 이미지 경로
 * @param {string} fileName
 * @returns {string}
 */
function publicImageUrl(fileName) {
  return `${window.location.origin}/images/${encodeURIComponent(fileName)}`
}

/**
 * 검정 배경 PNG → 투명 배경 data URL
 * @param {string} src
 * @returns {Promise<string>}
 */
async function loadTransparentImage(src) {
  const cached = transparentImageCache.get(src)
  if (cached) return cached

  const response = await fetch(src)
  if (!response.ok) throw new Error(`이미지를 불러오지 못했습니다: ${src}`)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)

  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('이미지 로드 실패'))
      el.src = objectUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('캔버스를 사용할 수 없습니다.')

    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const { data } = imageData

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      if (r <= BLACK_THRESHOLD && g <= BLACK_THRESHOLD && b <= BLACK_THRESHOLD) {
        data[i + 3] = 0
      }
    }

    ctx.putImageData(imageData, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    transparentImageCache.set(src, dataUrl)
    return dataUrl
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * @returns {Promise<{ posiri: string }>}
 */
async function loadPosiriAssets() {
  const posiri = await loadTransparentImage(publicImageUrl('포실이.png'))
  return { posiri }
}

/**
 * @param {Array<{ en: string, ko: string }>} words
 * @param {number} size
 * @returns {Array<Array<{ en: string, ko: string } | null>>}
 */
function chunkWords(words, size) {
  const pages = []
  for (let i = 0; i < words.length; i += size) {
    const slice = words.slice(i, i + size)
    while (slice.length < size) slice.push(null)
    pages.push(slice)
  }
  if (pages.length === 0) {
    pages.push(Array.from({ length: size }, () => null))
  }
  return pages
}

function sproutSvg() {
  return `<svg class="deco-sprout" viewBox="0 0 48 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="24" cy="48" rx="14" ry="6" fill="#8B6914"/>
    <path d="M24 46 V22" stroke="#2F6B2F" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M24 30 C14 28 10 18 16 12 C22 18 24 24 24 30Z" fill="#6BBF4A"/>
    <path d="M24 28 C32 24 38 16 34 10 C28 14 24 22 24 28Z" fill="#5AAE3C"/>
  </svg>`
}

/**
 * @param {{ en: string, ko: string } | null} word
 * @param {'en' | 'ko'} mode
 * @param {number} number
 */
function buildRow(word, mode, number) {
  const en = word ? (mode === 'en' ? word.en : '') : ''
  const ko = word ? (mode === 'ko' ? word.ko : '') : ''
  return `
    <tr>
      <td class="col-no">${number}</td>
      <td class="col-en">${escapeHtml(en)}</td>
      <td class="col-ko">${escapeHtml(ko)}</td>
    </tr>`
}

/**
 * @param {object} options
 */
function buildPageHtml({
  day,
  pageWords,
  pageIndex,
  pageCount,
  assets,
  startNumber,
  mode,
}) {
  const rows = pageWords
    .map((word, i) => buildRow(word, mode, startNumber + i))
    .join('')

  return `
  <section class="sheet">
    <header class="sheet-header">
      <div class="header-left">
        <img class="mascot mascot-header" src="${assets.posiri}" alt="포실이" />
        <div class="grass" aria-hidden="true"></div>
      </div>

      <div class="header-center">
        <h1 class="sheet-title">
          포실이 영어 단어장
          <span class="title-line"></span>
        </h1>
        <div class="meta-fields">
          <div class="meta-day">
            <span class="meta-label">DAY</span>
            <span class="meta-colon">:</span>
            <span class="day-box">${day}</span>
          </div>
          <div class="meta-date">
            <span class="meta-label">DATE</span>
            <span class="meta-colon">:</span>
            <span class="date-blanks">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          </div>
        </div>
      </div>

      <div class="header-right">
        ${sproutSvg()}
        <span class="page-num">${pageIndex + 1}/${pageCount}</span>
      </div>
    </header>

    <table class="vocab-table">
      <thead>
        <tr>
          <th class="col-no">No.</th>
          <th class="col-en">영어 단어</th>
          <th class="col-ko">뜻</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`
}

/**
 * @param {{ day: number, words: Array<{ en: string, ko: string }>, mode: 'en' | 'ko', assets: { posiri: string } }} options
 * @returns {string}
 */
function buildPrintHtml({ day, words, mode, assets }) {
  const pages = chunkWords(words, WORDS_PER_PAGE)
  const pageCount = pages.length

  const sheetsHtml = pages
    .map((pageWords, pageIndex) =>
      buildPageHtml({
        day,
        pageWords,
        mode,
        pageIndex,
        pageCount,
        assets,
        startNumber: pageIndex * WORDS_PER_PAGE + 1,
      }),
    )
    .join('')

  const docTitle =
    mode === 'en'
      ? `포실이 영어 단어장 DAY ${day} (영어)`
      : `포실이 영어 단어장 DAY ${day} (한글)`

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #222;
      font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .sheet {
      width: 190mm;
      min-height: 277mm;
      margin: 0 auto;
      padding: 8mm 8mm 6mm;
      page-break-after: always;
      break-after: page;
      display: flex;
      flex-direction: column;
      gap: 5mm;
      background: #faf7f0;
    }
    .sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    .sheet-header {
      display: grid;
      grid-template-columns: 32mm 1fr 22mm;
      gap: 3mm;
      align-items: flex-start;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .mascot {
      display: block;
      object-fit: contain;
      background: transparent;
    }
    .mascot-header {
      width: 28mm;
      height: 28mm;
    }
    .grass {
      width: 24mm;
      height: 4mm;
      margin-top: -2mm;
      background: linear-gradient(180deg, #7cbc4a 0%, #5a9a35 100%);
      border-radius: 40% 40% 30% 30%;
      opacity: 0.85;
    }

    .header-center {
      text-align: center;
      padding-top: 1mm;
    }
    .sheet-title {
      position: relative;
      display: inline-block;
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #1a1a1a;
      line-height: 1.2;
    }
    .title-line {
      display: block;
      height: 0;
      margin-top: 2mm;
      border-bottom: 2.5px solid #5f9e45;
      position: relative;
    }
    .title-line::after {
      content: '🌱';
      position: absolute;
      right: -2mm;
      top: -7px;
      font-size: 11px;
      line-height: 1;
    }

    .meta-fields {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8mm;
      margin-top: 4mm;
      font-size: 12px;
      font-weight: 700;
    }
    .meta-day, .meta-date {
      display: inline-flex;
      align-items: center;
      gap: 2mm;
    }
    .meta-label { letter-spacing: 0.04em; }
    .meta-colon { margin: 0 0.5mm; }
    .day-box {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 14mm;
      height: 7mm;
      padding: 0 2mm;
      border: 1.8px solid #222;
      border-radius: 3px;
      font-size: 13px;
      font-weight: 800;
    }
    .date-blanks {
      border-bottom: 1.5px solid #222;
      letter-spacing: 1px;
      font-weight: 500;
      min-width: 38mm;
      text-align: center;
    }

    .header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2mm;
    }
    .deco-sprout {
      width: 14mm;
      height: 16mm;
    }
    .page-num {
      font-size: 9px;
      color: #777;
      font-weight: 600;
    }

    .vocab-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border: 2.2px solid #222;
      border-radius: 10px;
      overflow: hidden;
      background: #fffef9;
      flex: 1;
    }
    .vocab-table th,
    .vocab-table td {
      border-bottom: 1.4px solid #222;
      border-right: 1.4px solid #222;
      padding: 0 2mm;
      font-size: 10.5px;
      height: 6.5mm;
      vertical-align: middle;
    }
    .vocab-table th:last-child,
    .vocab-table td:last-child { border-right: none; }
    .vocab-table tbody tr:last-child td { border-bottom: none; }
    .vocab-table thead th {
      background: #fffef9;
      font-weight: 800;
      font-size: 11px;
      text-align: center;
      height: 7mm;
    }
    .col-no {
      width: 14mm;
      text-align: center;
      font-weight: 700;
      color: #333;
    }
    .col-en {
      width: 42%;
      font-weight: 700;
      color: #1a1a1a;
    }
    .col-ko {
      color: #1a1a1a;
    }

    @page {
      size: A4;
      margin: 8mm;
    }

    @media print {
      html, body { background: #fff; }
      .sheet {
        width: auto;
        min-height: auto;
        margin: 0;
        padding: 0;
        background: #fff;
      }
    }
  </style>
</head>
<body>
  ${sheetsHtml}
</body>
</html>`
}

/**
 * Day 단어 목록을 포실이 단어장 양식으로 인쇄합니다.
 * @param {{ day: number, words: Array<{ en: string, ko: string }>, mode: 'en' | 'ko' }} options
 */
export async function printToeicDayPdf({ day, words, mode }) {
  const assets = await loadPosiriAssets()
  const html = buildPrintHtml({ day, words, mode, assets })

  const existing = document.getElementById('toeic-vocab-print-frame')
  if (existing) existing.remove()

  const iframe = document.createElement('iframe')
  iframe.id = 'toeic-vocab-print-frame'
  iframe.setAttribute('aria-hidden', 'true')
  // 인쇄 미리보기에서 이미지 렌더를 안정화하기 위해 잠시 보이게 둠
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)

  const frameWindow = iframe.contentWindow
  const frameDocument = frameWindow?.document
  if (!frameWindow || !frameDocument) {
    iframe.remove()
    throw new Error('인쇄 프레임을 만들 수 없습니다.')
  }

  frameDocument.open()
  frameDocument.write(html)
  frameDocument.close()

  // data URL 이미지는 동기 로드에 가깝지만 한 프레임 대기
  await new Promise((resolve) => setTimeout(resolve, 120))

  try {
    frameWindow.focus()
    frameWindow.print()
  } finally {
    setTimeout(() => {
      if (iframe.parentNode) iframe.remove()
    }, 800)
  }
}
