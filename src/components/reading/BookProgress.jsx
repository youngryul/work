import { useState } from 'react'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 책 읽은 위치(현재 페이지) 표시 및 수정
 * @param {{ book: Object, onSave: (page: number) => Promise<void> }} props
 */
export default function BookProgress({ book, onSave }) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const currentPage = book.currentPage || 0
  const pageCount = book.pageCount || 0
  const percent = pageCount > 0 ? Math.min(100, Math.round((currentPage / pageCount) * 100)) : null

  const startEdit = () => {
    setDraft(currentPage > 0 ? String(currentPage) : '')
    setIsEditing(true)
  }

  const handleSave = async () => {
    const page = draft === '' ? 0 : Number(draft)
    if (!Number.isInteger(page) || page < 0) {
      showToast('페이지는 0 이상의 숫자로 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (pageCount > 0 && page > pageCount) {
      showToast(`전체 ${pageCount}페이지를 넘을 수 없습니다.`, TOAST_TYPES.ERROR)
      return
    }
    try {
      await onSave(page)
      setIsEditing(false)
    } catch (error) {
      console.error('읽은 위치 저장 오류:', error)
      showToast('읽은 위치 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max={pageCount > 0 ? pageCount : undefined}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') setIsEditing(false)
            }}
            className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="페이지"
          />
          <span className="text-sm text-gray-600">
            {pageCount > 0 ? `/ ${pageCount}쪽` : '쪽까지 읽음'}
          </span>
          <button
            type="button"
            onClick={handleSave}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            취소
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-gray-700">
              📖{' '}
              {currentPage > 0 ? (
                <>
                  <b>{currentPage}쪽</b>까지 읽음
                  {pageCount > 0 && ` / ${pageCount}쪽 (${percent}%)`}
                </>
              ) : (
                <span className="text-gray-400">읽은 위치를 기록해보세요</span>
              )}
            </span>
            <button
              type="button"
              onClick={startEdit}
              className="shrink-0 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
            >
              {currentPage > 0 ? '위치 수정' : '위치 기록'}
            </button>
          </div>
          {percent !== null && currentPage > 0 && (
            <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
