import { useState } from 'react'
import { searchBooks, createBook } from '../../services/bookService.js'

/**
 * 책 검색 컴포넌트
 */
export default function BookSearch({ onBookSelect }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

  /**
   * 책 검색
   */
  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const results = await searchBooks(searchQuery)
      setSearchResults(results)
    } catch (error) {
      console.error('책 검색 오류:', error)
      alert('책 검색에 실패했습니다.')
    } finally {
      setIsSearching(false)
    }
  }

  /**
   * 책 등록
   */
  const handleRegisterBook = async (bookData) => {
    setIsRegistering(true)
    try {
      const registeredBook = await createBook(bookData)
      onBookSelect?.(registeredBook)
      setSearchQuery('')
      setSearchResults([])
    } catch (error) {
      console.error('책 등록 오류:', error)
      alert('책 등록에 실패했습니다.')
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-3xl font-bold text-gray-800 mb-4">책 검색 및 등록</h2>
      
      {/* 검색 입력 */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="책 제목을 입력하세요"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-base font-medium disabled:opacity-50"
        >
          {isSearching ? '검색 중...' : '검색'}
        </button>
      </div>

      {/* 검색 결과 */}
      {searchResults.length > 0 && (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {searchResults.map((book, index) => (
            <div
              key={index}
              className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              {book.thumbnailUrl && (
                <img
                  src={book.thumbnailUrl}
                  alt={book.title}
                  className="w-20 h-28 object-cover rounded border border-gray-300"
                />
              )}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800 mb-1">{book.title}</h3>
                <p className="text-gray-600 text-sm mb-2">저자: {book.author || '알 수 없음'}</p>
                <p className="text-gray-600 text-sm mb-2">출판사: {book.publisher || '알 수 없음'}</p>
                {book.pageCount > 0 && (
                  <p className="text-gray-600 text-sm mb-2">페이지: {book.pageCount}페이지</p>
                )}
                <button
                  onClick={() => handleRegisterBook(book)}
                  disabled={isRegistering}
                  className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200 text-sm font-medium disabled:opacity-50"
                >
                  {isRegistering ? '등록 중...' : '등록'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

