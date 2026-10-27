import { supabase } from '../config/supabase.js'

/**
 * 필기 노트 서비스 (보기 전용)
 * notebooks / notebook_pages 조회 — 필기·편집은 iOS 앱에서만 한다.
 * 파일은 비공개 notebooks 버킷에 있으므로 서명 URL로 보여준다.
 */

const NOTEBOOK_BUCKET = 'notebooks'
/** 서명 URL 유효 시간 (초) */
const SIGNED_URL_EXPIRES_IN = 60 * 60

/**
 * 노트 목록 (표지용 페이지 요약 포함, 최근 수정 순)
 * @returns {Promise<Array>}
 */
export async function fetchNotebooks() {
  const { data, error } = await supabase
    .from('notebooks')
    .select('id, title, cover_color, paper_type, pdf_path, updated_at, notebook_pages(preview_path, page_order, updated_at)')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('필기 노트 목록 조회 오류:', error)
    throw new Error(`노트 목록을 불러오지 못했습니다: ${error.message}`)
  }

  return (data ?? []).map((notebook) => {
    const pages = [...(notebook.notebook_pages ?? [])].sort((a, b) => a.page_order - b.page_order)
    return { ...notebook, notebook_pages: pages, pageCount: pages.length, coverPreviewPath: pages[0]?.preview_path ?? null }
  })
}

/**
 * 노트의 페이지 목록 (순서대로)
 * @param {string} notebookId
 * @returns {Promise<Array>}
 */
export async function fetchNotebookPages(notebookId) {
  const { data, error } = await supabase
    .from('notebook_pages')
    .select('id, notebook_id, page_order, paper_type, preview_path, recognized_text, updated_at')
    .eq('notebook_id', notebookId)
    .order('page_order', { ascending: true })

  if (error) {
    console.error('필기 노트 페이지 조회 오류:', error)
    throw new Error(`페이지를 불러오지 못했습니다: ${error.message}`)
  }

  return data ?? []
}

/**
 * 손글씨 인식 결과로 페이지 검색
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchNotebookPages(query) {
  const keyword = query.trim()
  if (!keyword) return []

  const { data, error } = await supabase
    .from('notebook_pages')
    .select('id, notebook_id, page_order, preview_path, recognized_text, updated_at, notebooks(title)')
    .ilike('recognized_text', `%${keyword}%`)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('필기 노트 검색 오류:', error)
    throw new Error(`검색하지 못했습니다: ${error.message}`)
  }

  return data ?? []
}

/**
 * Storage 경로 목록 → 서명 URL 맵
 * @param {Array<string|null|undefined>} paths
 * @returns {Promise<Record<string, string>>}
 */
export async function createNotebookSignedUrls(paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))]
  if (uniquePaths.length === 0) return {}

  const { data, error } = await supabase.storage
    .from(NOTEBOOK_BUCKET)
    .createSignedUrls(uniquePaths, SIGNED_URL_EXPIRES_IN)

  if (error) {
    console.error('필기 노트 이미지 URL 생성 오류:', error)
    return {}
  }

  /** @type {Record<string, string>} */
  const urlMap = {}
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) urlMap[item.path] = item.signedUrl
  }
  return urlMap
}
