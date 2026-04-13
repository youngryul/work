/**
 * 책 검색 및 관리 서비스
 * Google Books API를 활용한 책 검색 및 등록
 */
import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * Google Books volume 항목을 앱 공통 책 형식으로 변환
 * @param {Array} items - Google Books API items
 * @returns {Array<Object>}
 */
function mapGoogleBooksItems(items) {
  return items.map((item) => {
    const volumeInfo = item.volumeInfo || {}
    return {
      apiId: item.id,
      title: volumeInfo.title || '',
      author: volumeInfo.authors ? volumeInfo.authors.join(', ') : '',
      publisher: volumeInfo.publisher || '',
      isbn: volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier ||
        volumeInfo.industryIdentifiers?.find(id => id.type === 'ISBN_10')?.identifier || '',
      thumbnailUrl: volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || '',
      description: volumeInfo.description || '',
      pageCount: volumeInfo.pageCount || 0,
      publishedDate: volumeInfo.publishedDate || '',
      apiSource: 'google_books',
    }
  })
}

/**
 * Open Library 검색 문서를 앱 공통 책 형식으로 변환
 * @param {Object} doc - Open Library search.json doc
 * @returns {Object}
 */
function mapOpenLibraryDoc(doc) {
  const isbns = doc.isbn || []
  const isbnStr = (x) => String(x).replace(/-/g, '')
  const isbn13 = isbns.find((i) => isbnStr(i).length === 13)
  const isbn10 = isbns.find((i) => isbnStr(i).length === 10)
  return {
    apiId: doc.key || doc.cover_edition_key || (doc.cover_i != null ? `cover:${doc.cover_i}` : ''),
    title: doc.title || '',
    author: Array.isArray(doc.author_name) ? doc.author_name.join(', ') : (doc.author_name || ''),
    publisher: Array.isArray(doc.publisher) ? (doc.publisher[0] || '') : (doc.publisher || ''),
    isbn: isbn13 || isbn10 || isbns[0] || '',
    thumbnailUrl: doc.cover_i != null
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : '',
    description: '',
    pageCount: doc.number_of_pages_median || 0,
    publishedDate: doc.first_publish_year != null ? String(doc.first_publish_year) : '',
    apiSource: 'open_library',
  }
}

/**
 * Google Books API 검색 (선택: VITE_GOOGLE_BOOKS_API_KEY)
 * 키 없이 호출 시 공용 할당량 초과(429)가 자주 나므로, 실패 시 빈 배열을 반환합니다.
 * @param {string} q - trim된 검색어
 * @returns {Promise<Array>}
 */
async function searchBooksGoogle(q) {
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
    const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : ''
    const url =
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=20&langRestrict=ko${keyParam}`

    const response = await fetch(url)
    const data = await response.json().catch(() => ({}))

    if (data.error) {
      console.warn('[책 검색] Google Books:', data.error.message || data.error.status || '오류')
      return []
    }
    if (!response.ok || !data.items?.length) {
      return []
    }
    return mapGoogleBooksItems(data.items)
  } catch (e) {
    console.warn('[책 검색] Google Books 요청 실패:', e)
    return []
  }
}

/**
 * Open Library 검색 (API 키 불필요, Google 할당량 문제 시 대체)
 * 검색어는 최소 3자여야 합니다.
 * @param {string} q - trim된 검색어
 * @returns {Promise<Array>}
 */
async function searchBooksOpenLibrary(q) {
  if (q.length < 3) {
    return []
  }
  try {
    const url =
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=20`
    const response = await fetch(url)
    if (!response.ok) {
      return []
    }
    const data = await response.json().catch(() => ({}))
    if (data.detail) {
      console.warn('[책 검색] Open Library:', data.detail)
      return []
    }
    if (!data.docs?.length) {
      return []
    }
    return data.docs.map(mapOpenLibraryDoc)
  } catch (e) {
    console.warn('[책 검색] Open Library 요청 실패:', e)
    return []
  }
}

/**
 * 책 검색 (Google Books 우선, 실패·결과 없음 시 Open Library)
 * @param {string} query - 검색어 (책 제목)
 * @returns {Promise<Array>} 검색된 책 목록
 */
export async function searchBooks(query) {
  const q = (query || '').trim()
  if (!q) {
    return []
  }

  const fromGoogle = await searchBooksGoogle(q)
  if (fromGoogle.length > 0) {
    return fromGoogle
  }

  const fromOl = await searchBooksOpenLibrary(q)
  return fromOl
}

/**
 * 책 등록
 * @param {Object} bookData - 책 데이터
 * @returns {Promise<Object>} 등록된 책
 */
export async function createBook(bookData) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    // 기존 책 확인 (ISBN으로, 같은 사용자의 책만)
    if (bookData.isbn) {
      const { data: existing } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId)
        .eq('isbn', bookData.isbn)
        .single()

      if (existing) {
        return normalizeBook(existing)
      }
    }

    const { data, error } = await supabase
      .from('books')
      .insert([{
        title: bookData.title,
        author: bookData.author || null,
        publisher: bookData.publisher || null,
        isbn: bookData.isbn || null,
        thumbnail_url: bookData.thumbnailUrl || null,
        description: bookData.description || null,
        page_count: bookData.pageCount || null,
        published_date: bookData.publishedDate || null,
        api_source: bookData.apiSource || null,
        api_id: bookData.apiId || null,
        user_id: userId,
      }])
      .select()
      .single()

    if (error) {
      console.error('책 등록 오류:', error)
      throw error
    }

    return normalizeBook(data)
  } catch (error) {
    console.error('책 등록 실패:', error)
    throw error
  }
}

/**
 * 등록된 모든 책 조회
 * @returns {Promise<Array>} 책 목록
 */
export async function getAllBooks() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('책 조회 오류:', error)
      throw error
    }

    return (data || []).map(normalizeBook)
  } catch (error) {
    console.error('책 조회 실패:', error)
    throw error
  }
}

/**
 * 책 상세 조회
 * @param {string} id - 책 ID
 * @returns {Promise<Object|null>} 책 정보
 */
export async function getBookById(id) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('책 조회 오류:', error)
      throw error
    }

    return normalizeBook(data)
  } catch (error) {
    console.error('책 조회 실패:', error)
    throw error
  }
}

/**
 * 책 완료 상태 업데이트 및 한줄 인사이트 저장
 * @param {string} bookId - 책 ID
 * @param {boolean} isCompleted - 완료 여부
 * @param {string} oneLineInsight - 한줄 인사이트 (선택사항)
 * @returns {Promise<Object>} 업데이트된 책 정보
 */
export async function updateBookCompletion(bookId, isCompleted, oneLineInsight = null) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const updateData = {
      is_completed: isCompleted,
      updated_at: new Date().toISOString(),
    }

    if (oneLineInsight !== null) {
      updateData.one_line_insight = oneLineInsight || null
    }

    const { data, error } = await supabase
      .from('books')
      .update(updateData)
      .eq('id', bookId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('책 완료 상태 업데이트 오류:', error)
      throw error
    }

    return normalizeBook(data)
  } catch (error) {
    console.error('책 완료 상태 업데이트 실패:', error)
    throw error
  }
}

/**
 * 데이터베이스 컬럼명을 camelCase로 변환
 */
function normalizeBook(book) {
  if (!book) return book
  return {
    ...book,
    thumbnailUrl: book.thumbnail_url ?? book.thumbnailUrl,
    pageCount: book.page_count ?? book.pageCount,
    publishedDate: book.published_date ?? book.publishedDate,
    apiSource: book.api_source ?? book.apiSource,
    apiId: book.api_id ?? book.apiId,
    isCompleted: book.is_completed ?? book.isCompleted ?? false,
    oneLineInsight: book.one_line_insight ?? book.oneLineInsight ?? null,
    createdAt: book.created_at ?? book.createdAt,
    updatedAt: book.updated_at ?? book.updatedAt,
  }
}

