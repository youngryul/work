import { useState, useEffect } from 'react'
import { getAllBooks, updateBookCompletion } from '../../services/bookService.js'
import { getReadingRecordsByBook, getMonthlyReadingStats, deleteReadingRecord } from '../../services/readingService.js'
import BookSearch from './BookSearch.jsx'
import ReadingRecordForm from './ReadingRecordForm.jsx'
import ReadingBookStack from './ReadingBookStack.jsx'
import OneLineInsightModal from './OneLineInsightModal.jsx'
import CompletedReadingNotesModal from './CompletedReadingNotesModal.jsx'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 완료 일자 포맷
 * @param {string | null | undefined} dateStr
 * @returns {string}
 */
function formatCompletedDate(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return dateStr
  return `${year}년 ${month}월 ${day}일`
}

/**
 * 독서 관리 메인 뷰
 */
export default function ReadingView() {
  const [books, setBooks] = useState([])
  const [selectedBook, setSelectedBook] = useState(null)
  const [readingRecords, setReadingRecords] = useState([])
  const [showBookSearch, setShowBookSearch] = useState(false)
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [showRecordDetail, setShowRecordDetail] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [editingRecord, setEditingRecord] = useState(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [monthlyStats, setMonthlyStats] = useState(null)
  const [showInsightModal, setShowInsightModal] = useState(false)
  const [bookToComplete, setBookToComplete] = useState(null)
  const [notesBook, setNotesBook] = useState(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  /**
   * 책 목록 로드
   */
  const loadBooks = async () => {
    try {
      const data = await getAllBooks()
      setBooks(data)
    } catch (error) {
      console.error('책 목록 로드 오류:', error)
    }
  }

  /**
   * 독서 기록 로드
   */
  const loadReadingRecords = async () => {
    if (!selectedBook) return

    try {
      const records = await getReadingRecordsByBook(selectedBook.id)
      setReadingRecords(records)
    } catch (error) {
      console.error('독서 기록 로드 오류:', error)
    }
  }

  /**
   * 월별 통계 로드
   */
  const loadMonthlyStats = async () => {
    try {
      const stats = await getMonthlyReadingStats(year, month)
      setMonthlyStats(stats)
    } catch (error) {
      console.error('월별 통계 로드 오류:', error)
    }
  }

  useEffect(() => {
    loadBooks()
    loadMonthlyStats()
  }, [currentDate])

  useEffect(() => {
    if (selectedBook) {
      loadReadingRecords()
    }
  }, [selectedBook])

  /**
   * 이전 달로 이동
   */
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1))
  }

  /**
   * 다음 달로 이동
   */
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1))
  }

  /**
   * 오늘로 이동
   */
  const handleToday = () => {
    setCurrentDate(new Date())
  }

  /**
   * 책 완료 처리
   */
  const handleCompleteBook = (book) => {
    if (book.isCompleted) {
      // 이미 완료된 책은 완료 해제
      handleUncompleteBook(book)
      return
    }

    setBookToComplete(book)
    setShowInsightModal(true)
  }

  /**
   * 책 완료 해제
   */
  const handleUncompleteBook = async (book) => {
    try {
      await updateBookCompletion(book.id, false, null)
      await loadBooks()
      showToast('완료 상태가 해제되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('책 완료 해제 오류:', error)
      showToast('완료 해제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 한줄 인사이트 저장
   */
  const handleSaveInsight = async (oneLineInsight) => {
    if (!bookToComplete) return

    try {
      const completedBook = await updateBookCompletion(bookToComplete.id, true, oneLineInsight)
      await loadBooks()
      if (selectedBook?.id === completedBook.id) {
        setSelectedBook(completedBook)
      }
      setShowInsightModal(false)
      setBookToComplete(null)
      setNotesBook(completedBook)
      showToast('책이 완료 처리되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('책 완료 처리 오류:', error)
      showToast('완료 처리에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 한줄 인사이트 모달 취소
   */
  const handleCancelInsight = () => {
    setShowInsightModal(false)
    setBookToComplete(null)
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-4xl font-handwriting text-gray-800 mb-2">독서 관리</h1>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePrevMonth}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200"
            >
              ←
            </button>
            <span className="text-2xl font-bold text-gray-800">
              {year}년 {month}월
            </span>
            <button
              onClick={handleNextMonth}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200"
            >
              →
            </button>
            <button
              onClick={handleToday}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-sm"
            >
              오늘
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBookSearch(true)}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-xl font-medium shadow-md"
            >
              + 책 등록
            </button>
            {selectedBook && (
              <button
                onClick={() => setShowRecordForm(true)}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200 text-xl font-medium shadow-md"
              >
                + 독서 기록
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 월별 통계 */}
      {monthlyStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
            <div className="text-4xl font-bold text-purple-600 mb-2">
              {monthlyStats.totalBooks}권
            </div>
            <div className="text-xl text-gray-700">읽은 책 수</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-6 border border-orange-200">
            <div className="text-4xl font-bold text-orange-600 mb-2">
              {monthlyStats.totalSessions}회
            </div>
            <div className="text-xl text-gray-700">독서 세션</div>
          </div>
        </div>
      )}

      {/* 책 목록 및 독서 기록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 책 목록 */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">등록된 책</h2>
          {books.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xl">
              등록된 책이 없습니다.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {books.map((book) => (
                <div
                  key={book.id}
                  onClick={() => setSelectedBook(book)}
                  className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                    selectedBook?.id === book.id
                      ? 'bg-blue-100 border-blue-400'
                      : book.isCompleted
                      ? 'bg-green-50 border-green-200 hover:bg-green-100'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex gap-4">
                    {book.thumbnailUrl && (
                      <img
                        src={book.thumbnailUrl}
                        alt={book.title}
                        className="w-16 h-20 object-cover rounded border border-gray-300"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-lg font-bold text-gray-800 flex-1">
                          {book.title}
                          {book.isCompleted && (
                            <span className="ml-2 text-green-600 text-base">✓ 완료</span>
                          )}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCompleteBook(book)
                          }}
                          className={`px-3 py-1 text-sm rounded-lg transition-colors duration-200 ${
                            book.isCompleted
                              ? 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                              : 'bg-green-500 text-white hover:bg-green-600'
                          }`}
                        >
                          {book.isCompleted ? '완료 해제' : '완료'}
                        </button>
                      </div>
                      <p className="text-gray-600 text-sm">저자: {book.author || '알 수 없음'}</p>
                      {book.isCompleted && book.completedAt && (
                        <p className="text-green-700 text-sm font-medium">
                          완료일: {formatCompletedDate(book.completedAt)}
                        </p>
                      )}
                      {book.pageCount > 0 && (
                        <p className="text-gray-600 text-sm">페이지: {book.pageCount}페이지</p>
                      )}
                      {book.isCompleted && book.oneLineInsight && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-gray-700">
                          <span className="font-semibold">💡 한줄 인사이트:</span> {book.oneLineInsight}
                        </div>
                      )}
                      {book.isCompleted && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setNotesBook(book)
                          }}
                          className="mt-2 px-3 py-1.5 text-sm rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                        >
                          그동안 쓴 내용 보기
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 독서 기록 */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-3xl font-bold text-gray-800">
              독서 기록 {selectedBook && `- ${selectedBook.title}`}
            </h2>
            {selectedBook?.isCompleted && (
              <button
                type="button"
                onClick={() => setNotesBook(selectedBook)}
                className="shrink-0 px-3 py-1.5 text-sm rounded-lg border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                그동안 쓴 내용
              </button>
            )}
          </div>
          {!selectedBook ? (
            <div className="text-center py-8 text-gray-400 text-xl">
              책을 선택해주세요.
            </div>
          ) : readingRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xl">
              독서 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {readingRecords.map((record) => (
                <div
                  key={record.id}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <div
                    onClick={() => {
                      // 독서 기록 상세 팝업 표시
                      setSelectedRecord(record)
                      setShowRecordDetail(true)
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-gray-800">{record.readingDate}</span>
                    </div>
                    {record.pagesRead && (
                      <p className="text-gray-600 text-sm mb-1">{record.pagesRead}페이지 읽음</p>
                    )}
                    {record.notes && (
                      <p className="text-gray-700 text-sm mt-2 line-clamp-2">{record.notes}</p>
                    )}
                  </div>
                  {/* 수정/삭제 버튼 */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingRecord(record)
                        setShowRecordForm(true)
                        setShowRecordDetail(false)
                      }}
                      className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
                    >
                      수정
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (confirm('정말 삭제하시겠습니까?')) {
                          try {
                            await deleteReadingRecord(record.id)
                            await loadReadingRecords()
                            await loadMonthlyStats()
                            showToast('독서 기록이 삭제되었습니다.', TOAST_TYPES.SUCCESS)
                          } catch (error) {
                            console.error('독서 기록 삭제 오류:', error)
                            showToast('독서 기록 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
                          }
                        }
                      }}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ReadingBookStack books={books} />

      {/* 책 검색 모달 */}
      {showBookSearch && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-3xl font-bold text-gray-800">책 검색 및 등록</h2>
                <button
                  onClick={() => {
                    setShowBookSearch(false)
                    loadBooks()
                  }}
                  className="text-gray-400 hover:text-gray-600 text-4xl leading-none"
                >
                  ×
                </button>
              </div>
              <BookSearch
                onBookSelect={(book) => {
                  setSelectedBook(book)
                  setShowBookSearch(false)
                  loadBooks()
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 독서 기록 폼 모달 */}
      {showRecordForm && selectedBook && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full my-8">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-3xl font-bold text-gray-800">독서 기록</h2>
                <button
                  onClick={() => {
                    setShowRecordForm(false)
                    loadReadingRecords()
                    loadMonthlyStats()
                  }}
                  className="text-gray-400 hover:text-gray-600 text-4xl leading-none"
                >
                  ×
                </button>
              </div>
              <ReadingRecordForm
                book={selectedBook}
                initialRecord={editingRecord}
                onSave={() => {
                  setShowRecordForm(false)
                  setEditingRecord(null)
                  loadReadingRecords()
                  loadMonthlyStats()
                }}
                onCancel={() => {
                  setShowRecordForm(false)
                  setEditingRecord(null)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 독서 기록 상세 팝업 */}
      {showRecordDetail && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-3xl font-bold text-gray-800">독서 기록 상세</h2>
                <button
                  onClick={() => {
                    setShowRecordDetail(false)
                    setSelectedRecord(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 text-4xl leading-none"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">독서 날짜</label>
                  <p className="text-lg font-bold text-gray-800">{selectedRecord.readingDate}</p>
                </div>
                
                {selectedRecord.pagesRead && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">읽은 페이지</label>
                    <p className="text-lg font-bold text-gray-800">{selectedRecord.pagesRead}페이지</p>
                  </div>
                )}
                
                {selectedRecord.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">메모</label>
                    <p className="text-lg text-gray-800 whitespace-pre-wrap mt-2 p-4 bg-gray-50 rounded-lg">
                      {selectedRecord.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 한줄 인사이트 모달 */}
      {showInsightModal && bookToComplete && (
        <OneLineInsightModal
          book={bookToComplete}
          onSave={handleSaveInsight}
          onCancel={handleCancelInsight}
        />
      )}

      {/* 완료 책 — 독서 메모 전체 합쳐 보기 */}
      {notesBook && (
        <CompletedReadingNotesModal
          book={notesBook}
          onClose={() => setNotesBook(null)}
        />
      )}
    </div>
  )
}

