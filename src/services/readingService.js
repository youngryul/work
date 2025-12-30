/**
 * 독서 기록 서비스
 * 독서 활동 기록 및 통계 관리
 */
import { supabase } from '../config/supabase.js'

/**
 * 독서 기록 생성
 * @param {Object} recordData - 독서 기록 데이터
 * @returns {Promise<Object>} 생성된 독서 기록
 */
export async function createReadingRecord(recordData) {
  try {
    const { data, error } = await supabase
      .from('reading_records')
      .insert([{
        book_id: recordData.bookId,
        reading_date: recordData.readingDate,
        start_time: recordData.startTime || null,
        end_time: recordData.endTime || null,
        reading_minutes: recordData.readingMinutes || null,
        pages_read: recordData.pagesRead || null,
        notes: recordData.notes || null,
      }])
      .select()
      .single()

    if (error) {
      console.error('독서 기록 생성 오류:', error)
      throw error
    }

    return normalizeReadingRecord(data)
  } catch (error) {
    console.error('독서 기록 생성 실패:', error)
    throw error
  }
}

/**
 * 특정 책의 독서 기록 조회
 * @param {string} bookId - 책 ID
 * @returns {Promise<Array>} 독서 기록 목록
 */
export async function getReadingRecordsByBook(bookId) {
  try {
    const { data, error } = await supabase
      .from('reading_records')
      .select('*')
      .eq('book_id', bookId)
      .order('reading_date', { ascending: false })

    if (error) {
      console.error('독서 기록 조회 오류:', error)
      throw error
    }

    return (data || []).map(normalizeReadingRecord)
  } catch (error) {
    console.error('독서 기록 조회 실패:', error)
    throw error
  }
}

/**
 * 독서 기록 수정
 * @param {string} id - 독서 기록 ID
 * @param {Object} recordData - 수정할 독서 기록 데이터
 * @returns {Promise<Object>} 수정된 독서 기록
 */
export async function updateReadingRecord(id, recordData) {
  try {
    // 시작 시간과 종료 시간이 모두 있으면 실제 차이를 계산
    let finalReadingMinutes = recordData.readingMinutes
    if (recordData.startTime && recordData.endTime) {
      const start = new Date(recordData.startTime)
      const end = new Date(recordData.endTime)
      const diffMs = end.getTime() - start.getTime()
      finalReadingMinutes = Math.max(0, Math.floor(diffMs / 60000))
    }

    const { data, error } = await supabase
      .from('reading_records')
      .update({
        reading_date: recordData.readingDate,
        start_time: recordData.startTime || null,
        end_time: recordData.endTime || null,
        reading_minutes: finalReadingMinutes || null,
        pages_read: recordData.pagesRead || null,
        notes: recordData.notes || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('독서 기록 수정 오류:', error)
      throw error
    }

    return normalizeReadingRecord(data)
  } catch (error) {
    console.error('독서 기록 수정 실패:', error)
    throw error
  }
}

/**
 * 독서 기록 삭제
 * @param {string} id - 독서 기록 ID
 * @returns {Promise<boolean>} 삭제 성공 여부
 */
export async function deleteReadingRecord(id) {
  try {
    const { error } = await supabase
      .from('reading_records')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('독서 기록 삭제 오류:', error)
      throw error
    }

    return true
  } catch (error) {
    console.error('독서 기록 삭제 실패:', error)
    throw error
  }
}

/**
 * 특정 월의 독서 기록 조회
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {Promise<Array>} 독서 기록 목록
 */
export async function getReadingRecordsByMonth(year, month) {
  try {
    // 각 월의 실제 마지막 날짜 계산
    const lastDay = new Date(year, month, 0).getDate()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('reading_records')
      .select('*')
      .gte('reading_date', startDate)
      .lte('reading_date', endDate)
      .order('reading_date', { ascending: false })

    if (error) {
      console.error('월별 독서 기록 조회 오류:', error)
      throw error
    }

    return (data || []).map(normalizeReadingRecord)
  } catch (error) {
    console.error('월별 독서 기록 조회 실패:', error)
    throw error
  }
}

/**
 * 월별 독서 통계 조회
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {Promise<Object>} 통계 데이터
 */
export async function getMonthlyReadingStats(year, month) {
  try {
    const records = await getReadingRecordsByMonth(year, month)
    
    const totalMinutes = records.reduce((sum, record) => sum + (record.readingMinutes || 0), 0)
    const totalPages = records.reduce((sum, record) => sum + (record.pagesRead || 0), 0)
    const totalBooks = new Set(records.map(record => record.bookId)).size
    const totalSessions = records.length

    return {
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      totalPages,
      totalBooks,
      totalSessions,
      averageMinutesPerSession: totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0,
    }
  } catch (error) {
    console.error('월별 독서 통계 조회 실패:', error)
    throw error
  }
}

/**
 * 월별 독서 AI 분석
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {Promise<string>} AI 분석 결과
 */
export async function generateMonthlyReadingAnalysis(year, month) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.')
  }

  try {
    const records = await getReadingRecordsByMonth(year, month)
    
    if (records.length === 0) {
      return `${year}년 ${month}월에는 독서 기록이 없습니다.`
    }

    const stats = await getMonthlyReadingStats(year, month)
    
    // 책 정보 가져오기
    const bookIds = [...new Set(records.map(r => r.bookId))]
    const { data: booksData } = await supabase
      .from('books')
      .select('id, title')
      .in('id', bookIds)
    
    const booksMap = {}
    if (booksData) {
      booksData.forEach(book => {
        booksMap[book.id] = book
      })
    }

    // 독서 기록 요약
    const readingSummary = records.map((record, index) => {
      const book = booksMap[record.bookId] || {}
      return `${index + 1}. ${book.title || '알 수 없음'} - ${record.readingDate}: ${record.readingMinutes || 0}분, ${record.pagesRead || 0}페이지`
    }).join('\n')

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `당신은 독서 활동을 분석하는 전문가입니다. 사용자가 제공한 월별 독서 기록을 바탕으로 심층적인 분석과 인사이트를 제공합니다.
            
요구사항:
1. 독서 패턴 분석 (시간대, 빈도, 지속성)
2. 독서 습관 평가 및 개선점 제시
3. 읽은 책들의 주제와 장르 분석
4. 다음 달 독서 목표 제안
5. 마크다운 형식으로 작성

형식:
- 제목: [년월] 독서 활동 분석
- 독서 통계 요약
- 독서 패턴 분석
- 주요 인사이트
- 개선 제안
- 다음 달 목표`
          },
          {
            role: 'user',
            content: `다음은 ${year}년 ${month}월의 독서 기록입니다.

통계:
- 총 독서 시간: ${stats.totalHours}시간 (${stats.totalMinutes}분)
- 총 읽은 페이지: ${stats.totalPages}페이지
- 읽은 책 수: ${stats.totalBooks}권
- 독서 세션: ${stats.totalSessions}회
- 세션당 평균 시간: ${stats.averageMinutesPerSession}분

독서 기록:
${readingSummary}

위 데이터를 바탕으로 월별 독서 활동을 분석해주세요.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`AI 분석 실패: ${errorData.error?.message || '알 수 없는 오류'}`)
    }

    const data = await response.json()
    return data.choices[0].message.content.trim()
  } catch (error) {
    console.error('월별 독서 AI 분석 오류:', error)
    throw error
  }
}

/**
 * 데이터베이스 컬럼명을 camelCase로 변환
 */
function normalizeReadingRecord(record) {
  if (!record) return record
  return {
    ...record,
    bookId: record.book_id ?? record.bookId,
    readingDate: record.reading_date ?? record.readingDate,
    startTime: record.start_time ?? record.startTime,
    endTime: record.end_time ?? record.endTime,
    readingMinutes: record.reading_minutes ?? record.readingMinutes,
    pagesRead: record.pages_read ?? record.pagesRead,
    createdAt: record.created_at ?? record.createdAt,
    updatedAt: record.updated_at ?? record.updatedAt,
  }
}

