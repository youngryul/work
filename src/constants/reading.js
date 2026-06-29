/** 페이지당 추정 독서 시간 (분) */
export const READING_MINUTES_PER_PAGE = 2

/**
 * 읽은 페이지 수로 독서 시간(분) 추정
 * @param {number | string | null | undefined} pages
 * @returns {number | null}
 */
export function estimateReadingMinutesFromPages(pages) {
  const parsed = Number.parseInt(String(pages), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed * READING_MINUTES_PER_PAGE
}
