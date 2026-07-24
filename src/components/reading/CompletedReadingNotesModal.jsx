import { useEffect, useState } from 'react'
import { getReadingRecordsByBook } from '../../services/readingService.js'

/**
 * 독서 기록에서 메모가 있는 항목만 날짜순으로 정리
 * @param {Array} records
 * @returns {Array<{ id: string, readingDate: string, pagesRead: number|null, notes: string }>}
 */
export function collectReadingNotes(records) {
  return (records || [])
    .filter((record) => (record.notes || '').trim())
    .slice()
    .sort((a, b) => {
      const byDate = String(a.readingDate || '').localeCompare(String(b.readingDate || ''))
      if (byDate !== 0) return byDate
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    })
    .map((record) => ({
      id: record.id,
      readingDate: record.readingDate,
      pagesRead: record.pagesRead || null,
      notes: (record.notes || '').trim(),
    }))
}

/**
 * 완료된 책의 독서 메모를 전체 합쳐 보여주는 모달
 * @param {{
 *   book: object,
 *   onClose: () => void,
 * }} props
 */
export default function CompletedReadingNotesModal({ book, onClose }) {
  const [isLoading, setIsLoading] = useState(true)
  const [noteEntries, setNoteEntries] = useState([])
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!book?.id) return
      setIsLoading(true)
      setErrorMessage('')
      try {
        const records = await getReadingRecordsByBook(book.id)
        if (!cancelled) {
          setNoteEntries(collectReadingNotes(records))
        }
      } catch (error) {
        console.error('독서 메모 모음 로드 오류:', error)
        if (!cancelled) {
          setErrorMessage('그동안 쓴 내용을 불러오지 못했습니다.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [book?.id])

  const combinedText = noteEntries
    .map((entry) => {
      const meta = [
        entry.readingDate,
        entry.pagesRead ? `${entry.pagesRead}페이지` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      return `[${meta}]\n${entry.notes}`
    })
    .join('\n\n')

  const handleCopy = async () => {
    const parts = []
    if (book?.oneLineInsight) {
      parts.push(`한줄 인사이트: ${book.oneLineInsight}`)
    }
    if (combinedText) {
      parts.push(combinedText)
    }
    const text = parts.join('\n\n')
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error('클립보드 복사 오류:', error)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">그동안 쓴 내용</h2>
              <p className="text-sm text-gray-600 mt-1">{book?.title}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-4xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {book?.oneLineInsight && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-semibold text-yellow-800 mb-1">한줄 인사이트</p>
              <p className="text-gray-800 whitespace-pre-wrap">{book.oneLineInsight}</p>
            </div>
          )}

          {isLoading ? (
            <p className="text-center text-gray-500 py-10">불러오는 중...</p>
          ) : errorMessage ? (
            <p className="text-center text-red-500 py-10">{errorMessage}</p>
          ) : noteEntries.length === 0 ? (
            <p className="text-center text-gray-400 py-10">
              기록에 남긴 메모가 없습니다.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                독서 기록 메모 {noteEntries.length}개를 날짜순으로 모았습니다.
              </p>
              {noteEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-gray-600">
                    <span className="font-semibold text-gray-800">{entry.readingDate}</span>
                    {entry.pagesRead ? (
                      <span>· {entry.pagesRead}페이지</span>
                    ) : null}
                  </div>
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {entry.notes}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-2">
          {(noteEntries.length > 0 || book?.oneLineInsight) && (
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
            >
              전체 복사
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 text-sm font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
