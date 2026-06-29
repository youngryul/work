import { useEffect, useMemo, useState } from 'react'

const BOOK_BLOCK_HEIGHT_PX = 52
const BOOK_DROP_DURATION_MS = 550
const BOOK_DROP_STAGGER_MS = 320
const MAX_VISIBLE_STACK = 12

/**
 * 완료일 기준 오름차순 정렬 (아래가 먼저 읽은 책)
 * @param {Array} books
 * @returns {Array}
 */
function sortCompletedBooks(books) {
  return [...books]
    .filter((book) => book.isCompleted)
    .sort((a, b) => {
      const dateA = a.completedAt || ''
      const dateB = b.completedAt || ''
      if (dateA && dateB && dateA !== dateB) {
        return dateA.localeCompare(dateB)
      }
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
    })
}

/**
 * 완독한 책을 포실이 탑처럼 위에서 떨어져 쌓는 애니메이션
 * @param {{ books: Array }} props
 */
export default function ReadingBookStack({ books }) {
  const completedBooks = useMemo(() => sortCompletedBooks(books), [books])
  const [animatedCount, setAnimatedCount] = useState(0)

  useEffect(() => {
    setAnimatedCount(0)
    if (completedBooks.length === 0) return undefined

    let current = 0
    const timer = window.setInterval(() => {
      current += 1
      setAnimatedCount(current)
      if (current >= completedBooks.length) {
        window.clearInterval(timer)
      }
    }, BOOK_DROP_STAGGER_MS)

    return () => window.clearInterval(timer)
  }, [completedBooks])

  const visibleBooks = completedBooks.slice(-MAX_VISIBLE_STACK)
  const hiddenCount = Math.max(0, completedBooks.length - MAX_VISIBLE_STACK)
  const stackHeight = Math.min(completedBooks.length, MAX_VISIBLE_STACK) * BOOK_BLOCK_HEIGHT_PX

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 font-sans">포실이 독서 탑</h2>
          <p className="text-sm text-gray-500 font-sans mt-1">
            지금까지 완독한 책 {completedBooks.length}권
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-b from-sky-100 via-amber-50 to-amber-100 p-6 min-h-[420px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-sky-200/40 to-transparent" />

        {completedBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[320px] text-center">
            <img
              src="/images/포실이.png"
              alt="포실이"
              className="w-24 h-24 object-contain mb-4 opacity-80"
            />
            <p className="text-lg text-gray-600 font-sans">아직 완독한 책이 없어요</p>
            <p className="text-sm text-gray-400 font-sans mt-1">책을 다 읽고 완료 버튼을 눌러보세요!</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-end min-h-[360px]">
            {hiddenCount > 0 && (
              <p className="mb-3 text-xs text-amber-800 bg-amber-100/80 px-3 py-1 rounded-full font-sans">
                아래 {hiddenCount}권은 탑 아래에 쌓여 있어요
              </p>
            )}

            <div
              className="relative flex flex-col-reverse items-center w-full max-w-xs"
              style={{ minHeight: `${stackHeight + 88}px` }}
            >
              {visibleBooks.map((book, index) => {
                const globalIndex = completedBooks.length - visibleBooks.length + index
                const isVisible = globalIndex < animatedCount

                return (
                  <div
                    key={book.id}
                    className={`reading-book-stack-item w-full mb-1 ${isVisible ? 'is-dropped' : 'is-waiting'}`}
                    style={{
                      height: `${BOOK_BLOCK_HEIGHT_PX}px`,
                      zIndex: index + 1,
                    }}
                    title={book.title}
                  >
                    <div className="h-full flex items-center gap-3 px-3 rounded-xl border-2 border-amber-300/80 bg-white/95 shadow-md overflow-hidden">
                      {book.thumbnailUrl ? (
                        <img
                          src={book.thumbnailUrl}
                          alt=""
                          className="w-9 h-11 object-cover rounded shrink-0 border border-gray-200"
                        />
                      ) : (
                        <div className="w-9 h-11 shrink-0 rounded bg-amber-100 flex items-center justify-center text-lg">
                          📚
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-800 truncate font-sans">{book.title}</p>
                        <p className="text-xs text-gray-500 truncate font-sans">
                          {book.author || '저자 미상'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}

              {animatedCount >= completedBooks.length && (
                <div className="reading-book-stack-posily mb-2 flex flex-col items-center">
                  <img
                    src="/images/포실이.png"
                    alt="포실이"
                    className="w-16 h-16 object-contain drop-shadow-lg"
                  />
                  <span className="text-xs font-bold text-amber-800 mt-1 font-sans">탑 정상!</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="absolute inset-x-8 bottom-4 h-3 rounded-full bg-amber-300/60 blur-[1px]" />
      </div>

      <style>{`
        .reading-book-stack-item.is-waiting {
          opacity: 0;
          transform: translateY(-120px) scale(0.92);
        }

        .reading-book-stack-item.is-dropped {
          animation: reading-book-drop ${BOOK_DROP_DURATION_MS}ms cubic-bezier(0.34, 1.2, 0.64, 1) both;
        }

        .reading-book-stack-posily {
          animation: reading-posily-land 500ms cubic-bezier(0.34, 1.3, 0.64, 1) both;
        }

        @keyframes reading-book-drop {
          0% {
            opacity: 0;
            transform: translateY(calc(-100% - 120px)) scale(0.9) rotate(-2deg);
          }
          70% {
            opacity: 1;
          }
          82% {
            transform: translateY(6px) scale(1.03) rotate(0.5deg);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1) rotate(0deg);
          }
        }

        @keyframes reading-posily-land {
          0% {
            opacity: 0;
            transform: translateY(-80px) scale(0.6);
          }
          60% {
            transform: translateY(8px) scale(1.08);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}
