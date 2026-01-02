import { useState, useEffect } from 'react'
import { getAllBooks } from '../../services/bookService.js'
import { getReadingRecordsByBook, getMonthlyReadingStats, generateMonthlyReadingAnalysis, deleteReadingRecord } from '../../services/readingService.js'
import BookSearch from './BookSearch.jsx'
import ReadingRecordForm from './ReadingRecordForm.jsx'
import ReactMarkdown from 'react-markdown'

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
  const [monthlyAnalysis, setMonthlyAnalysis] = useState(null)
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  /**
   * 독서 시간 포맷팅 (1분 미만이면 초 단위로 표시)
   */
  const formatReadingTime = (record) => {
    if (!record.readingMinutes && !record.startTime) {
      return null
    }

    // 시작/종료 시간이 있으면 정확한 초 단위 계산
    if (record.startTime && record.endTime) {
      const start = new Date(record.startTime)
      const end = new Date(record.endTime)
      const diffMs = end.getTime() - start.getTime()
      const totalSeconds = Math.floor(diffMs / 1000)
      
      if (totalSeconds < 60) {
        return `${totalSeconds}초`
      } else {
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        if (seconds > 0) {
          return `${minutes}분 ${seconds}초`
        } else {
          return `${minutes}분`
        }
      }
    }

    // readingMinutes만 있는 경우
    if (record.readingMinutes !== null && record.readingMinutes !== undefined) {
      if (record.readingMinutes < 1) {
        // 1분 미만이면 초로 변환 (대략적인 값)
        const seconds = Math.round(record.readingMinutes * 60)
        return `${seconds}초`
      } else {
        return `${record.readingMinutes}분`
      }
    }

    return null
  }

  /**
   * 총 독서 시간 포맷팅
   */
  const formatTotalReadingTime = (records) => {
    const totalSeconds = records.reduce((sum, record) => {
      if (record.startTime && record.endTime) {
        const start = new Date(record.startTime)
        const end = new Date(record.endTime)
        return sum + Math.floor((end.getTime() - start.getTime()) / 1000)
      } else if (record.readingMinutes) {
        return sum + (record.readingMinutes * 60)
      }
      return sum
    }, 0)

    if (totalSeconds < 60) {
      return `${totalSeconds}초`
    } else {
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      if (seconds > 0) {
        return `${minutes}분 ${seconds}초`
      } else {
        return `${minutes}분`
      }
    }
  }

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

  /**
   * 현재 월 기준 이전 월인지 확인
   */
  const isPastMonth = () => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    
    if (year < currentYear) {
      return true
    }
    if (year === currentYear && month < currentMonth) {
      return true
    }
    return false
  }

  /**
   * 월별 AI 분석 생성
   */
  const handleGenerateAnalysis = async () => {
    if (!isPastMonth()) {
      alert('현재 월과 미래 월은 분석을 생성할 수 없습니다. 이전 월만 분석 가능합니다.')
      return
    }

    setIsGeneratingAnalysis(true)
    try {
      const analysis = await generateMonthlyReadingAnalysis(year, month)
      setMonthlyAnalysis(analysis)
    } catch (error) {
      console.error('AI 분석 생성 오류:', error)
      alert('AI 분석 생성에 실패했습니다.')
    } finally {
      setIsGeneratingAnalysis(false)
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {monthlyStats.totalHours}시간
            </div>
            <div className="text-xl text-gray-700">총 독서 시간</div>
          </div>
          <div className="bg-green-50 rounded-lg p-6 border border-green-200">
            <div className="text-4xl font-bold text-green-600 mb-2">
              {monthlyStats.totalPages}페이지
            </div>
            <div className="text-xl text-gray-700">총 읽은 페이지</div>
          </div>
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
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedBook?.id === book.id
                      ? 'bg-blue-100 border-blue-400'
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
                      <h3 className="text-lg font-bold text-gray-800 mb-1">{book.title}</h3>
                      <p className="text-gray-600 text-sm">저자: {book.author || '알 수 없음'}</p>
                      {book.pageCount > 0 && (
                        <p className="text-gray-600 text-sm">페이지: {book.pageCount}페이지</p>
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-3xl font-bold text-gray-800">
              독서 기록 {selectedBook && `- ${selectedBook.title}`}
            </h2>
            {readingRecords.length > 0 && (
              <div className="text-right">
                <div className="text-sm text-gray-600">총 독서 시간</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatTotalReadingTime(readingRecords)}
                </div>
              </div>
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
                      {formatReadingTime(record) && (
                        <span className="text-2xl font-bold text-blue-600">{formatReadingTime(record)}</span>
                      )}
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
                            alert('독서 기록이 삭제되었습니다.')
                          } catch (error) {
                            console.error('독서 기록 삭제 오류:', error)
                            alert('독서 기록 삭제에 실패했습니다.')
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

      {/* 월별 AI 분석 (하단 배치) */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-bold text-gray-800">월별 독서 분석</h2>
          <button
            onClick={handleGenerateAnalysis}
            disabled={isGeneratingAnalysis || !isPastMonth()}
            className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors duration-200 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title={!isPastMonth() ? '현재 월과 미래 월은 분석을 생성할 수 없습니다. 이전 월만 분석 가능합니다.' : ''}
          >
            {isGeneratingAnalysis ? '분석 중...' : '🤖 AI 분석 생성'}
          </button>
        </div>
        {!isPastMonth() && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-sm">
              현재 월과 미래 월은 분석을 생성할 수 없습니다. 이전 월만 분석 가능합니다.
            </p>
          </div>
        )}
        {monthlyAnalysis && (
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-800 font-sans leading-relaxed">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-3 text-gray-900" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-4 mb-2 text-gray-900" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-3 mb-2 text-gray-800" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-2 text-gray-700 text-sm" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-700 text-sm" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-700 text-sm" {...props} />,
                  li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                  strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
                }}
              >
                {monthlyAnalysis}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

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
                
                {formatReadingTime(selectedRecord) && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">독서 시간</label>
                    <p className="text-2xl font-bold text-blue-600">{formatReadingTime(selectedRecord)}</p>
                  </div>
                )}
                
                {selectedRecord.pagesRead && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">읽은 페이지</label>
                    <p className="text-lg font-bold text-gray-800">{selectedRecord.pagesRead}페이지</p>
                  </div>
                )}
                
                {selectedRecord.startTime && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">시작 시간</label>
                    <p className="text-lg text-gray-800">
                      {new Date(selectedRecord.startTime).toLocaleString('ko-KR')}
                    </p>
                  </div>
                )}
                
                {selectedRecord.endTime && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">종료 시간</label>
                    <p className="text-lg text-gray-800">
                      {new Date(selectedRecord.endTime).toLocaleString('ko-KR')}
                    </p>
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
                
                {formatReadingTime(selectedRecord) && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">독서 시간</label>
                    <p className="text-2xl font-bold text-blue-600">{formatReadingTime(selectedRecord)}</p>
                  </div>
                )}
                
                {selectedRecord.pagesRead && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">읽은 페이지</label>
                    <p className="text-lg font-bold text-gray-800">{selectedRecord.pagesRead}페이지</p>
                  </div>
                )}
                
                {selectedRecord.startTime && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">시작 시간</label>
                    <p className="text-lg text-gray-800">
                      {new Date(selectedRecord.startTime).toLocaleString('ko-KR')}
                    </p>
                  </div>
                )}
                
                {selectedRecord.endTime && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">종료 시간</label>
                    <p className="text-lg text-gray-800">
                      {new Date(selectedRecord.endTime).toLocaleString('ko-KR')}
                    </p>
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
    </div>
  )
}

