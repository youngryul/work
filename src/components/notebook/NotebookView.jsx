import { useState, useEffect, useCallback } from 'react'
import {
  fetchNotebooks,
  fetchNotebookPages,
  searchNotebookPages,
  createNotebookSignedUrls,
} from '../../services/notebookService.js'
import ViewPageTitle from '../ViewPageTitle.jsx'

/** 표지 색 (iOS NotebookCoverColor와 동일) */
const COVER_COLORS = {
  green: '#8cbf85',
  sky: '#87b8e0',
  peach: '#f5ad94',
  lavender: '#b8a3e0',
  butter: '#f7d97a',
  charcoal: '#545761',
}

/** 검색 입력 후 대기 시간 (ms) */
const SEARCH_DELAY_MS = 400

/**
 * 날짜·시간 문자열을 한국어 짧은 형식으로
 * @param {string} isoString
 */
function formatUpdatedAt(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

/**
 * 검색어 주변 글자만 잘라서 보여준다
 * @param {string} text
 * @param {string} keyword
 */
function makeSnippet(text, keyword) {
  if (!text) return ''
  const index = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (index < 0) return text.slice(0, 80)
  const start = Math.max(0, index - 30)
  const end = Math.min(text.length, index + keyword.length + 50)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

/**
 * 미리보기 이미지 (없으면 빈 종이)
 * @param {{ url?: string, alt: string, className?: string }} props
 */
function PagePreview({ url, alt, className = '' }) {
  return (
    <div className={`bg-white overflow-hidden ${className}`}>
      {url ? (
        <img src={url} alt={alt} className="w-full h-full object-cover object-top" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-gray-300">빈 페이지</div>
      )}
    </div>
  )
}

/**
 * 필기 노트 (웹은 보기 전용 — 필기는 iOS 앱에서)
 */
export default function NotebookView() {
  const [notebooks, setNotebooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // 경로 → 서명 URL
  const [urlMap, setUrlMap] = useState({})

  // 열린 노트와 페이지
  const [openNotebook, setOpenNotebook] = useState(null)
  const [pages, setPages] = useState([])
  const [pageIndex, setPageIndex] = useState(0)
  const [pagesLoading, setPagesLoading] = useState(false)

  // 손글씨 검색
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const addSignedUrls = useCallback(async (paths) => {
    const map = await createNotebookSignedUrls(paths)
    setUrlMap((prev) => ({ ...prev, ...map }))
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchNotebooks()
        setNotebooks(data)
        await addSignedUrls(data.map((n) => n.coverPreviewPath))
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [addSignedUrls])

  // 검색어가 바뀌면 잠시 기다렸다가 검색
  useEffect(() => {
    const keyword = searchText.trim()
    if (!keyword) {
      setSearchResults([])
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchNotebookPages(keyword)
        if (cancelled) return
        setSearchResults(results)
        await addSignedUrls(results.map((r) => r.preview_path))
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchText, addSignedUrls])

  const openNotebookAt = async (notebook, pageId = null) => {
    setOpenNotebook(notebook)
    setPages([])
    setPageIndex(0)
    setPagesLoading(true)
    try {
      const data = await fetchNotebookPages(notebook.id)
      setPages(data)
      const startIndex = pageId ? Math.max(0, data.findIndex((p) => p.id === pageId)) : 0
      setPageIndex(startIndex)
      await addSignedUrls(data.map((p) => p.preview_path))
    } catch (e) {
      setError(e.message)
    } finally {
      setPagesLoading(false)
    }
  }

  // 키보드 ← → 로 페이지 넘기기
  useEffect(() => {
    if (!openNotebook) return undefined
    const handleKey = (event) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.key === 'ArrowLeft') setPageIndex((i) => Math.max(0, i - 1))
      if (event.key === 'ArrowRight') setPageIndex((i) => Math.min(pages.length - 1, i + 1))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [openNotebook, pages.length])

  const keyword = searchText.trim()
  const filteredNotebooks = keyword
    ? notebooks.filter((n) => (n.title || '').toLowerCase().includes(keyword.toLowerCase()))
    : notebooks

  // ===== 노트 보기 =====
  if (openNotebook) {
    const currentPage = pages[pageIndex]
    const currentUrl = currentPage ? urlMap[currentPage.preview_path] : null

    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            type="button"
            onClick={() => setOpenNotebook(null)}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            ← 노트 목록
          </button>
          <h1 className="text-2xl font-handwriting text-gray-800 truncate">{openNotebook.title || '제목 없는 노트'}</h1>
          {currentUrl ? (
            <a
              href={currentUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-sky-600 hover:underline shrink-0"
            >
              이미지 열기
            </a>
          ) : (
            <span className="w-16" />
          )}
        </div>

        {pagesLoading ? (
          <p className="text-center text-gray-400 py-20">불러오는 중…</p>
        ) : pages.length === 0 ? (
          <p className="text-center text-gray-400 py-20">페이지가 없어요.</p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                disabled={pageIndex === 0}
                className="hidden sm:block text-3xl text-gray-400 hover:text-gray-700 disabled:opacity-20"
                aria-label="이전 페이지"
              >
                ‹
              </button>
              <div className="flex-1 max-w-3xl mx-auto">
                <PagePreview
                  url={currentUrl}
                  alt={`${pageIndex + 1}쪽`}
                  className="w-full aspect-[768/1086] rounded-lg shadow-md border border-gray-200"
                />
              </div>
              <button
                type="button"
                onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
                disabled={pageIndex >= pages.length - 1}
                className="hidden sm:block text-3xl text-gray-400 hover:text-gray-700 disabled:opacity-20"
                aria-label="다음 페이지"
              >
                ›
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 mt-3">
              {pageIndex + 1} / {pages.length}
            </p>

            {/* 페이지 썸네일 */}
            <div className="flex gap-2 overflow-x-auto py-3 mt-2">
              {pages.map((page, index) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setPageIndex(index)}
                  className={`shrink-0 rounded border-2 ${index === pageIndex ? 'border-green-500' : 'border-transparent'}`}
                >
                  <PagePreview
                    url={urlMap[page.preview_path]}
                    alt={`${index + 1}쪽`}
                    className="w-16 aspect-[768/1086] rounded-sm border border-gray-200"
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // ===== 노트 목록 =====
  return (
    <div className="max-w-5xl mx-auto p-6">
      <ViewPageTitle icon="✍️" title="필기 노트">
        <p className="text-sm text-gray-500">필기는 iOS 포실이 앱의 ‘더보기 › 필기 노트’에서 할 수 있어요. 웹에서는 보기만 돼요.</p>
      </ViewPageTitle>

      <input
        type="search"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="노트 제목·손글씨 검색"
        className="w-full mb-6 px-4 py-2 border border-gray-200 rounded-full bg-white focus:outline-none focus:ring-1 focus:ring-sky-300"
      />

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {keyword && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-600 mb-3">손글씨에서 찾은 페이지</h2>
          {searching ? (
            <p className="text-sm text-gray-400">검색 중…</p>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-gray-400">일치하는 페이지가 없어요.</p>
          ) : (
            <ul className="space-y-2">
              {searchResults.map((page) => {
                const notebook = notebooks.find((n) => n.id === page.notebook_id)
                return (
                  <li key={page.id}>
                    <button
                      type="button"
                      onClick={() => notebook && openNotebookAt(notebook, page.id)}
                      className="w-full flex gap-3 p-2 text-left rounded-lg bg-gray-50 hover:bg-gray-100"
                    >
                      <PagePreview
                        url={urlMap[page.preview_path]}
                        alt="검색된 페이지"
                        className="w-14 shrink-0 aspect-[768/1086] rounded-sm border border-gray-200"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-700">{page.notebooks?.title || '제목 없는 노트'}</p>
                        <p className="text-xs text-gray-500 line-clamp-3">{makeSnippet(page.recognized_text, keyword)}</p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-20">불러오는 중…</p>
      ) : filteredNotebooks.length === 0 ? (
        <p className="text-center text-gray-400 py-20">
          {keyword ? '제목이 일치하는 노트가 없어요.' : '아직 노트가 없어요. iOS 앱에서 첫 노트를 만들어 보세요.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
          {filteredNotebooks.map((notebook) => (
            <button
              key={notebook.id}
              type="button"
              onClick={() => openNotebookAt(notebook)}
              className="text-left group"
            >
              <div
                className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-shadow"
                style={{ backgroundColor: COVER_COLORS[notebook.cover_color] ?? COVER_COLORS.green }}
              >
                <div className="absolute inset-y-0 left-0 w-2 bg-black/10" />
                <PagePreview
                  url={urlMap[notebook.coverPreviewPath]}
                  alt={`${notebook.title} 첫 페이지`}
                  className="absolute top-2.5 bottom-2.5 left-[18px] right-2.5 rounded shadow"
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-gray-800 truncate">{notebook.title || '제목 없는 노트'}</p>
              <p className="text-xs text-gray-400">
                {notebook.pdf_path ? 'PDF · ' : ''}
                {notebook.pageCount}쪽 · {formatUpdatedAt(notebook.updated_at)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
