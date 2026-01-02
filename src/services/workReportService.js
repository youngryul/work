/**
 * 업무일지 AI 요약 서비스
 * 완료한 할일들을 업무일지 형태로 요약 및 정리
 */
import { supabase } from '../config/supabase.js'
import { getCurrentUserId } from '../utils/authHelper.js'

/**
 * 특정 날짜의 완료한 할일 목록을 업무일지 형태로 AI 요약
 * @param {Array} tasks - 완료한 할일 목록
 * @param {string} dateString - 날짜 문자열 (YYYY-MM-DD)
 * @returns {Promise<string>} AI가 생성한 업무일지 요약
 */
export async function generateDailyWorkReport(tasks, dateString) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.')
  }

  if (!tasks || tasks.length === 0) {
    return `${dateString}에는 완료한 할일이 없습니다.`
  }

  // 날짜 포맷팅
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const weekday = weekdays[date.getDay()]
  const formattedDate = `${year}년 ${month}월 ${day}일 (${weekday})`

  // 할일 목록 생성
  const tasksList = tasks.map((task) => {
    const category = task.category ? `[${task.category}]` : ''
    return `${category} ${task.title}`.trim()
  }).join('\n')

  try {
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
            content: `당신은 전문적인 업무일지 작성자입니다. 사용자가 제공한 특정 날짜의 완료한 할일 목록을 바탕으로 그 날의 업무일지를 작성합니다.
            
요구사항:
1. 해당 날짜에 완료한 작업을 체계적으로 정리
2. 업무의 주요 성과와 핵심 내용을 요약
3. 전문적이면서도 읽기 쉬운 형식으로 작성
4. 마크다운 형식을 사용하여 가독성 향상
5. 해당 날짜의 업무 패턴과 특징을 분석하여 인사이트 제공
6. 개선할 점을 구체적이고 실행 가능한 형태로 제시 (예: 시간 관리, 우선순위 설정, 작업 효율성 등)

형식:
- 제목: [날짜] 업무일지
- 주요 작업 요약
- 일일 총평 및 인사이트
- 개선할 점 (구체적이고 실행 가능한 제안)`
          },
          {
            role: 'user',
            content: `다음은 ${formattedDate}에 완료한 할일 목록입니다. 이를 바탕으로 업무일지를 작성해주세요.

${tasksList}

총 ${tasks.length}개의 할일을 완료했습니다.`
          }
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenAI API 오류:', errorData)
      throw new Error(`업무일지 생성 실패: ${errorData.error?.message || '알 수 없는 오류'}`)
    }

    const data = await response.json()
    return data.choices[0].message.content.trim()
  } catch (error) {
    console.error('업무일지 생성 오류:', error)
    throw error
  }
}

/**
 * 업무일지 저장 (DB)
 * @param {string} dateString - 날짜 문자열 (YYYY-MM-DD)
 * @param {string} reportContent - 업무일지 내용
 * @returns {Promise<Object>} 저장된 업무일지
 */
export async function saveWorkReport(dateString, reportContent) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    // 기존 업무일지 확인
    const existing = await getWorkReport(dateString)
    
    if (existing) {
      // 업데이트
      const { data, error } = await supabase
        .from('work_reports')
        .update({
          report_content: reportContent,
          updated_at: new Date().toISOString(),
        })
        .eq('date', dateString)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('업무일지 업데이트 오류:', error)
        throw error
      }

      return data
    } else {
      // 생성
      const { data, error } = await supabase
        .from('work_reports')
        .insert({
          date: dateString,
          report_content: reportContent,
          user_id: userId,
        })
        .select()
        .single()

      if (error) {
        console.error('업무일지 생성 오류:', error)
        throw error
      }

      return data
    }
  } catch (error) {
    console.error('업무일지 저장 실패:', error)
    throw error
  }
}

/**
 * 특정 날짜의 업무일지 조회 (DB)
 * @param {string} dateString - 날짜 문자열 (YYYY-MM-DD)
 * @returns {Promise<string|null>} 업무일지 내용 또는 null
 */
export async function getWorkReport(dateString) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('work_reports')
      .select('report_content')
      .eq('date', dateString)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // 데이터가 없음
        return null
      }
      console.error('업무일지 조회 오류:', error)
      throw error
    }

    return data?.report_content || null
  } catch (error) {
    console.error('업무일지 조회 실패:', error)
    throw error
  }
}

/**
 * 특정 월의 업무일지가 생성된 날짜 목록 조회 (DB)
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {Promise<Array<string>>} 날짜 문자열 배열 (YYYY-MM-DD)
 */
export async function getWorkReportDatesByMonth(year, month) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    // 각 월의 실제 마지막 날짜 계산
    const lastDay = new Date(year, month, 0).getDate()
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data, error } = await supabase
      .from('work_reports')
      .select('date')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) {
      console.error('업무일지 날짜 조회 오류:', error)
      throw error
    }

    return (data || []).map(item => item.date)
  } catch (error) {
    console.error('업무일지 날짜 조회 실패:', error)
    throw error
  }
}

/**
 * 주간 업무일지가 생성된 주 목록 조회 (업무일지 1개 이상인 주)
 * @param {number} year - 연도
 * @returns {Promise<Array<Object>>} 주 정보 배열 [{ weekStart, weekEnd, reportCount }]
 */
export async function getWeeksWithWorkReports(year) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const { data, error } = await supabase
      .from('work_reports')
      .select('date')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })

    if (error) {
      console.error('업무일지 조회 오류:', error)
      throw error
    }

    if (!data || data.length === 0) {
      return []
    }

    // 주별로 그룹화
    const weeksMap = new Map()
    
    data.forEach((item) => {
      const date = new Date(item.date)
      const weekStart = getWeekStart(date)
      const weekEnd = getWeekEnd(date)
      const weekKey = weekStart.toISOString().split('T')[0]

      if (!weeksMap.has(weekKey)) {
        weeksMap.set(weekKey, {
          weekStart: weekKey,
          weekEnd: weekEnd.toISOString().split('T')[0],
          reportCount: 0,
          dates: []
        })
      }
      
      const week = weeksMap.get(weekKey)
      week.reportCount++
      week.dates.push(item.date)
    })

    // 주 시작일 기준으로 정렬
    return Array.from(weeksMap.values()).sort((a, b) => 
      a.weekStart.localeCompare(b.weekStart)
    )
  } catch (error) {
    console.error('주간 업무일지 조회 실패:', error)
    throw error
  }
}

/**
 * 주의 시작일 계산 (일요일)
 */
export function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  return new Date(d.setDate(diff))
}

/**
 * 주의 종료일 계산 (토요일)
 */
export function getWeekEnd(date) {
  const weekStart = getWeekStart(date)
  return new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000)
}

/**
 * 주간 일기가 있는 주 목록 조회 (일기 1개 이상인 주)
 * @param {number} year - 연도
 * @returns {Promise<Array<Object>>} 주 정보 배열 [{ weekStart, weekEnd, diaryCount, diaries }]
 */
export async function getWeeksWithDiaries(year) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return []
  }

  try {
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const { getDiariesByMonth } = await import('./diaryService.js')
    
    // 해당 연도의 모든 일기 조회
    const allDiaries = []
    for (let month = 1; month <= 12; month++) {
      const diaries = await getDiariesByMonth(year, month)
      allDiaries.push(...diaries)
    }

    if (allDiaries.length === 0) {
      return []
    }

    // 주별로 그룹화
    const weeksMap = new Map()
    
    allDiaries.forEach((diary) => {
      const date = new Date(diary.date)
      const weekStart = getWeekStart(date)
      const weekEnd = getWeekEnd(date)
      const weekKey = weekStart.toISOString().split('T')[0]

      if (!weeksMap.has(weekKey)) {
        weeksMap.set(weekKey, {
          weekStart: weekKey,
          weekEnd: weekEnd.toISOString().split('T')[0],
          diaryCount: 0,
          diaries: []
        })
      }
      
      const week = weeksMap.get(weekKey)
      week.diaryCount++
      week.diaries.push(diary)
    })

    // 주 시작일 기준으로 정렬
    return Array.from(weeksMap.values()).sort((a, b) => 
      a.weekStart.localeCompare(b.weekStart)
    )
  } catch (error) {
    console.error('주간 일기 조회 실패:', error)
    throw error
  }
}

/**
 * 주간 업무일지 생성
 * @param {string} weekStart - 주 시작일 (YYYY-MM-DD)
 * @param {string} weekEnd - 주 종료일 (YYYY-MM-DD)
 * @param {Array<string>} reportDates - 해당 주의 업무일지 날짜 배열
 * @returns {Promise<string>} AI가 생성한 주간 업무일지
 */
export async function generateWeeklyWorkReport(weekStart, weekEnd, reportDates) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.')
  }

  if (!reportDates || reportDates.length === 0) {
    throw new Error('업무일지가 없습니다.')
  }

  // 해당 주의 모든 업무일지 조회
  const reports = []
  for (const date of reportDates) {
    const report = await getWorkReport(date)
    if (report) {
      reports.push({ date, content: report })
    }
  }

  if (reports.length === 0) {
    throw new Error('업무일지 내용을 불러올 수 없습니다.')
  }

  // 날짜 포맷팅
  const [startYear, startMonth, startDay] = weekStart.split('-').map(Number)
  const [endYear, endMonth, endDay] = weekEnd.split('-').map(Number)
  const formattedWeek = `${startYear}년 ${startMonth}월 ${startDay}일 ~ ${endYear}년 ${endMonth}월 ${endDay}일`

  // 업무일지 요약
  const reportsSummary = reports.map((r, idx) => {
    const [year, month, day] = r.date.split('-').map(Number)
    return `## ${year}년 ${month}월 ${day}일\n${r.content}`
  }).join('\n\n---\n\n')

  try {
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
            content: `당신은 전문적인 주간 업무일지 작성자입니다. 사용자가 제공한 한 주간의 일일 업무일지들을 종합하여 주간 업무일지를 작성합니다.

요구사항:
1. 한 주간의 업무일지들을 종합하여 주간 업무일지 작성
2. 주간 주요 성과와 핵심 내용을 요약
3. 주간 업무 패턴과 특징을 분석하여 인사이트 제공
4. 전문적이면서도 읽기 쉬운 형식으로 작성
5. 마크다운 형식을 사용하여 가독성 향상
6. 주간 개선할 점을 구체적이고 실행 가능한 형태로 제시

형식:
- 제목: [주간 기간] 주간 업무일지
- 주간 주요 작업 요약
- 주간 총평 및 인사이트
- 주간 개선할 점`
          },
          {
            role: 'user',
            content: `다음은 ${formattedWeek} 주간의 일일 업무일지들입니다. 이를 바탕으로 주간 업무일지를 작성해주세요.

${reportsSummary}

총 ${reports.length}개의 일일 업무일지가 있습니다.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenAI API 오류:', errorData)
      throw new Error(`주간 업무일지 생성 실패: ${errorData.error?.message || '알 수 없는 오류'}`)
    }

    const data = await response.json()
    return data.choices[0].message.content.trim()
  } catch (error) {
    console.error('주간 업무일지 생성 오류:', error)
    throw error
  }
}

/**
 * 월간 업무일지 생성 (편지 형식)
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {Promise<string>} AI가 생성한 월간 업무일지 (편지 형식)
 */
export async function generateMonthlyWorkReport(year, month) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.')
  }

  // 해당 월의 모든 업무일지 조회
  const reportDates = await getWorkReportDatesByMonth(year, month)
  
  if (reportDates.length === 0) {
    throw new Error(`${year}년 ${month}월에는 업무일지가 없습니다.`)
  }

  // 해당 월의 모든 업무일지 내용 조회
  const reports = []
  for (const date of reportDates) {
    const report = await getWorkReport(date)
    if (report) {
      reports.push({ date, content: report })
    }
  }

  if (reports.length === 0) {
    throw new Error('업무일지 내용을 불러올 수 없습니다.')
  }

  // 업무일지 요약
  const reportsSummary = reports.map((r) => {
    const [y, m, d] = r.date.split('-').map(Number)
    return `## ${y}년 ${m}월 ${d}일\n${r.content}`
  }).join('\n\n---\n\n')

  try {
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
            content: `당신은 따뜻하고 친근한 편지 작가입니다. 사용자가 제공한 한 달간의 업무일지들을 바탕으로 월간 업무일지를 편지 형식으로 작성합니다.

요구사항:
1. 한 달간의 업무일지들을 종합하여 월간 업무일지를 편지 형식으로 작성
2. "안녕하세요, [이름]님" 또는 "안녕, [이름]아" 같은 친근한 인사로 시작
3. 한 달간의 주요 성과와 핵심 내용을 요약
4. 한 달간의 업무 패턴과 특징을 분석하여 인사이트 제공
5. 따뜻하고 격려하는 톤으로 작성
6. 마크다운 형식을 사용하여 가독성 향상
7. 다음 달을 위한 격려와 조언 포함
8. "다음 달에도 화이팅!" 같은 마무리 문구 포함

형식:
- 편지 인사
- 한 달간의 주요 작업 요약
- 한 달간의 총평 및 인사이트
- 다음 달을 위한 격려와 조언
- 편지 마무리`
          },
          {
            role: 'user',
            content: `다음은 ${year}년 ${month}월의 일일 업무일지들입니다. 이를 바탕으로 월간 업무일지를 편지 형식으로 작성해주세요.

${reportsSummary}

총 ${reports.length}개의 일일 업무일지가 있습니다.`
          }
        ],
        max_tokens: 2500,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenAI API 오류:', errorData)
      throw new Error(`월간 업무일지 생성 실패: ${errorData.error?.message || '알 수 없는 오류'}`)
    }

    const data = await response.json()
    return data.choices[0].message.content.trim()
  } catch (error) {
    console.error('월간 업무일지 생성 오류:', error)
    throw error
  }
}

/**
 * 주간 일기 정리 생성
 * @param {string} weekStart - 주 시작일 (YYYY-MM-DD)
 * @param {string} weekEnd - 주 종료일 (YYYY-MM-DD)
 * @param {Array<Object>} diaries - 해당 주의 일기 배열
 * @returns {Promise<string>} AI가 생성한 주간 일기 정리
 */
export async function generateWeeklyDiarySummary(weekStart, weekEnd, diaries) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.')
  }

  if (!diaries || diaries.length === 0) {
    throw new Error('일기가 없습니다.')
  }

  // 날짜 포맷팅
  const [startYear, startMonth, startDay] = weekStart.split('-').map(Number)
  const [endYear, endMonth, endDay] = weekEnd.split('-').map(Number)
  const formattedWeek = `${startYear}년 ${startMonth}월 ${startDay}일 ~ ${endYear}년 ${endMonth}월 ${endDay}일`

  // 일기 요약
  const diariesSummary = diaries.map((d) => {
    const [year, month, day] = d.date.split('-').map(Number)
    return `## ${year}년 ${month}월 ${day}일\n${d.content}`
  }).join('\n\n---\n\n')

  try {
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
            content: `당신은 전문적인 일기 정리 작성자입니다. 사용자가 제공한 한 주간의 일기들을 종합하여 주간 일기 정리를 작성합니다.

요구사항:
1. 한 주간의 일기들을 종합하여 주간 일기 정리 작성
2. 감정의 흐름과 변화를 분석
3. 주요 사건과 경험을 요약
4. 주간 감정 패턴과 특징을 분석하여 인사이트 제공
5. 따뜻하고 공감하는 톤으로 작성
6. 마크다운 형식을 사용하여 가독성 향상
7. 다음 주를 위한 격려와 조언 포함

형식:
- 제목: [주간 기간] 주간 일기 정리
- 주간 주요 경험 요약
- 감정의 흐름과 변화
- 주간 총평 및 인사이트
- 다음 주를 위한 다짐`
          },
          {
            role: 'user',
            content: `다음은 ${formattedWeek} 주간의 일기들입니다. 이를 바탕으로 주간 일기 정리를 작성해주세요.

${diariesSummary}

총 ${diaries.length}개의 일기가 있습니다.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenAI API 오류:', errorData)
      throw new Error(`주간 일기 정리 생성 실패: ${errorData.error?.message || '알 수 없는 오류'}`)
    }

    const data = await response.json()
    return data.choices[0].message.content.trim()
  } catch (error) {
    console.error('주간 일기 정리 생성 오류:', error)
    throw error
  }
}

/**
 * 월간 일기 정리 생성 (편지 형식)
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @param {Array<Object>} diaries - 해당 월의 일기 배열
 * @returns {Promise<string>} AI가 생성한 월간 일기 정리 (편지 형식)
 */
export async function generateMonthlyDiarySummary(year, month, diaries) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.')
  }

  if (!diaries || diaries.length === 0) {
    throw new Error(`${year}년 ${month}월에는 일기가 없습니다.`)
  }

  // 일기 요약
  const diariesSummary = diaries.map((d) => {
    const [y, m, day] = d.date.split('-').map(Number)
    return `## ${y}년 ${m}월 ${day}일\n${d.content}`
  }).join('\n\n---\n\n')

  try {
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
            content: `당신은 따뜻하고 친근한 편지 작가입니다. 사용자가 제공한 한 달간의 일기들을 바탕으로 월간 일기 정리를 편지 형식으로 작성합니다.

요구사항:
1. 한 달간의 일기들을 종합하여 월간 일기 정리를 편지 형식으로 작성
2. "안녕하세요, [이름]님" 또는 "안녕, [이름]아" 같은 친근한 인사로 시작
3. 한 달간의 주요 경험과 감정을 요약
4. 한 달간의 감정 패턴과 특징을 분석하여 인사이트 제공
5. 따뜻하고 격려하는 톤으로 작성
6. 마크다운 형식을 사용하여 가독성 향상
7. 다음 달을 위한 격려와 조언 포함
8. "다음 달에도 화이팅!" 같은 마무리 문구 포함

형식:
- 편지 인사
- 한 달간의 주요 경험 요약
- 감정의 흐름과 변화
- 한 달간의 총평 및 인사이트
- 다음 달을 위한 격려와 조언
- 편지 마무리`
          },
          {
            role: 'user',
            content: `다음은 ${year}년 ${month}월의 일기들입니다. 이를 바탕으로 월간 일기 정리를 편지 형식으로 작성해주세요.

${diariesSummary}

총 ${diaries.length}개의 일기가 있습니다.`
          }
        ],
        max_tokens: 2500,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenAI API 오류:', errorData)
      throw new Error(`월간 일기 정리 생성 실패: ${errorData.error?.message || '알 수 없는 오류'}`)
    }

    const data = await response.json()
    return data.choices[0].message.content.trim()
  } catch (error) {
    console.error('월간 일기 정리 생성 오류:', error)
    throw error
  }
}

/**
 * 업무일지 + 일기 통합 회고록 생성 (사용 안 함 - 제거 예정)
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12, 선택사항)
 * @returns {Promise<string>} AI가 생성한 통합 회고록
 */
export async function generateIntegratedReview(year, month = null) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.')
  }

  // 업무일지와 일기 데이터 가져오기
  const { getDiariesByMonth } = await import('./diaryService.js')

  let workReports = []
  let diaries = []

  if (month) {
    // 특정 월의 데이터
    const reportDates = await getWorkReportDatesByMonth(year, month)
    for (const date of reportDates) {
      const report = await getWorkReport(date)
      if (report) {
        workReports.push({ date, content: report })
      }
    }
    diaries = await getDiariesByMonth(year, month)
  } else {
    // 연간 데이터
    for (let m = 1; m <= 12; m++) {
      const reportDates = await getWorkReportDatesByMonth(year, m)
      for (const date of reportDates) {
        const report = await getWorkReport(date)
        if (report) {
          workReports.push({ date, content: report })
        }
      }
      const monthDiaries = await getDiariesByMonth(year, m)
      diaries = diaries.concat(monthDiaries)
    }
  }

  if (workReports.length === 0 && diaries.length === 0) {
    throw new Error('업무일지와 일기 데이터가 없습니다.')
  }

  // 데이터 요약
  const workReportsSummary = workReports.length > 0
    ? workReports.map((r) => {
        const [y, m, d] = r.date.split('-').map(Number)
        return `## ${y}년 ${m}월 ${d}일 업무일지\n${r.content}`
      }).join('\n\n---\n\n')
    : '업무일지가 없습니다.'

  const diariesSummary = diaries.length > 0
    ? diaries.map((d) => {
        const [y, m, day] = d.date.split('-').map(Number)
        return `## ${y}년 ${m}월 ${day}일 일기\n${d.content}`
      }).join('\n\n---\n\n')
    : '일기가 없습니다.'

  const period = month 
    ? `${year}년 ${month}월`
    : `${year}년`

  try {
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
            content: `당신은 전문적인 회고록 작성자입니다. 사용자가 제공한 업무일지와 일기를 종합하여 깊이 있는 회고록을 작성합니다.

요구사항:
1. 업무일지와 일기를 함께 분석하여 통합 회고록 작성
2. 업무와 개인 생활의 균형, 패턴, 인사이트를 발견
3. 업무에서의 성과와 일기에서 드러나는 감정/생각을 연결하여 분석
4. 전문적이면서도 따뜻한 톤으로 작성
5. 마크다운 형식을 사용하여 가독성 향상
6. 구체적인 인사이트와 성장 포인트 제시
7. 다음 기간을 위한 방향성과 조언 포함

형식:
- 제목: [기간] 회고록
- 업무와 일상의 통합 분석
- 주요 성과와 인사이트
- 감정과 업무의 연결점
- 성장 포인트와 개선 방향
- 다음 기간을 위한 다짐`
          },
          {
            role: 'user',
            content: `다음은 ${period}의 업무일지와 일기입니다. 이를 바탕으로 통합 회고록을 작성해주세요.

## 업무일지
${workReportsSummary}

## 일기
${diariesSummary}

총 ${workReports.length}개의 업무일지와 ${diaries.length}개의 일기가 있습니다.`
          }
        ],
        max_tokens: 3000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenAI API 오류:', errorData)
      throw new Error(`회고록 생성 실패: ${errorData.error?.message || '알 수 없는 오류'}`)
    }

    const data = await response.json()
    return data.choices[0].message.content.trim()
  } catch (error) {
    console.error('회고록 생성 오류:', error)
    throw error
  }
}

/**
 * 주간 업무일지 저장
 * @param {string} weekStart - 주 시작일 (YYYY-MM-DD)
 * @param {string} weekEnd - 주 종료일 (YYYY-MM-DD)
 * @param {string} reportContent - 주간 업무일지 내용
 * @returns {Promise<Object>} 저장된 주간 업무일지
 */
export async function saveWeeklyWorkReport(weekStart, weekEnd, reportContent) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const year = new Date(weekStart).getFullYear()
    
    // 기존 주간 업무일지 확인
    const existing = await getWeeklyWorkReport(weekStart, weekEnd)
    
    if (existing) {
      // 업데이트
      const { data, error } = await supabase
        .from('weekly_work_reports')
        .update({
          report_content: reportContent,
          updated_at: new Date().toISOString(),
        })
        .eq('week_start', weekStart)
        .eq('week_end', weekEnd)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('주간 업무일지 업데이트 오류:', error)
        throw error
      }

      return data
    } else {
      // 생성
      const { data, error } = await supabase
        .from('weekly_work_reports')
        .insert({
          week_start: weekStart,
          week_end: weekEnd,
          year: year,
          report_content: reportContent,
          user_id: userId,
        })
        .select()
        .single()

      if (error) {
        console.error('주간 업무일지 생성 오류:', error)
        throw error
      }

      return data
    }
  } catch (error) {
    console.error('주간 업무일지 저장 실패:', error)
    throw error
  }
}

/**
 * 주간 업무일지 조회
 * @param {string} weekStart - 주 시작일 (YYYY-MM-DD)
 * @param {string} weekEnd - 주 종료일 (YYYY-MM-DD)
 * @returns {Promise<Object|null>} 주간 업무일지 또는 null
 */
export async function getWeeklyWorkReport(weekStart, weekEnd) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('weekly_work_reports')
      .select('*')
      .eq('week_start', weekStart)
      .eq('week_end', weekEnd)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('주간 업무일지 조회 오류:', error)
      throw error
    }

    return data ? {
      ...data,
      weekStart: data.week_start,
      weekEnd: data.week_end,
      reportContent: data.report_content,
    } : null
  } catch (error) {
    console.error('주간 업무일지 조회 실패:', error)
    throw error
  }
}

/**
 * 월간 업무일지 저장
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @param {string} reportContent - 월간 업무일지 내용
 * @returns {Promise<Object>} 저장된 월간 업무일지
 */
export async function saveMonthlyWorkReport(year, month, reportContent) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    // 기존 월간 업무일지 확인
    const existing = await getMonthlyWorkReport(year, month)
    
    if (existing) {
      // 업데이트
      const { data, error } = await supabase
        .from('monthly_work_reports')
        .update({
          report_content: reportContent,
          updated_at: new Date().toISOString(),
        })
        .eq('year', year)
        .eq('month', month)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('월간 업무일지 업데이트 오류:', error)
        throw error
      }

      return data
    } else {
      // 생성
      const { data, error } = await supabase
        .from('monthly_work_reports')
        .insert({
          year: year,
          month: month,
          report_content: reportContent,
          user_id: userId,
        })
        .select()
        .single()

      if (error) {
        console.error('월간 업무일지 생성 오류:', error)
        throw error
      }

      return data
    }
  } catch (error) {
    console.error('월간 업무일지 저장 실패:', error)
    throw error
  }
}

/**
 * 월간 업무일지 조회
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {Promise<Object|null>} 월간 업무일지 또는 null
 */
export async function getMonthlyWorkReport(year, month) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('monthly_work_reports')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('월간 업무일지 조회 오류:', error)
      throw error
    }

    return data ? {
      ...data,
      reportContent: data.report_content,
    } : null
  } catch (error) {
    console.error('월간 업무일지 조회 실패:', error)
    throw error
  }
}

/**
 * 주간 일기 정리 저장
 * @param {string} weekStart - 주 시작일 (YYYY-MM-DD)
 * @param {string} weekEnd - 주 종료일 (YYYY-MM-DD)
 * @param {string} summaryContent - 주간 일기 정리 내용
 * @returns {Promise<Object>} 저장된 주간 일기 정리
 */
export async function saveWeeklyDiarySummary(weekStart, weekEnd, summaryContent) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    const year = new Date(weekStart).getFullYear()
    
    // 기존 주간 일기 정리 확인
    const existing = await getWeeklyDiarySummary(weekStart, weekEnd)
    
    if (existing) {
      // 업데이트
      const { data, error } = await supabase
        .from('weekly_diary_summaries')
        .update({
          summary_content: summaryContent,
          updated_at: new Date().toISOString(),
        })
        .eq('week_start', weekStart)
        .eq('week_end', weekEnd)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('주간 일기 정리 업데이트 오류:', error)
        throw error
      }

      return data
    } else {
      // 생성
      const { data, error } = await supabase
        .from('weekly_diary_summaries')
        .insert({
          week_start: weekStart,
          week_end: weekEnd,
          year: year,
          summary_content: summaryContent,
          user_id: userId,
        })
        .select()
        .single()

      if (error) {
        console.error('주간 일기 정리 생성 오류:', error)
        throw error
      }

      return data
    }
  } catch (error) {
    console.error('주간 일기 정리 저장 실패:', error)
    throw error
  }
}

/**
 * 주간 일기 정리 조회
 * @param {string} weekStart - 주 시작일 (YYYY-MM-DD)
 * @param {string} weekEnd - 주 종료일 (YYYY-MM-DD)
 * @returns {Promise<Object|null>} 주간 일기 정리 또는 null
 */
export async function getWeeklyDiarySummary(weekStart, weekEnd) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('weekly_diary_summaries')
      .select('*')
      .eq('week_start', weekStart)
      .eq('week_end', weekEnd)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('주간 일기 정리 조회 오류:', error)
      throw error
    }

    return data ? {
      ...data,
      weekStart: data.week_start,
      weekEnd: data.week_end,
      summaryContent: data.summary_content,
    } : null
  } catch (error) {
    console.error('주간 일기 정리 조회 실패:', error)
    throw error
  }
}

/**
 * 월간 일기 정리 저장
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @param {string} summaryContent - 월간 일기 정리 내용
 * @returns {Promise<Object>} 저장된 월간 일기 정리
 */
export async function saveMonthlyDiarySummary(year, month, summaryContent) {
  const userId = await getCurrentUserId()
  if (!userId) {
    throw new Error('로그인이 필요합니다.')
  }

  try {
    // 기존 월간 일기 정리 확인
    const existing = await getMonthlyDiarySummary(year, month)
    
    if (existing) {
      // 업데이트
      const { data, error } = await supabase
        .from('monthly_diary_summaries')
        .update({
          summary_content: summaryContent,
          updated_at: new Date().toISOString(),
        })
        .eq('year', year)
        .eq('month', month)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('월간 일기 정리 업데이트 오류:', error)
        throw error
      }

      return data
    } else {
      // 생성
      const { data, error } = await supabase
        .from('monthly_diary_summaries')
        .insert({
          year: year,
          month: month,
          summary_content: summaryContent,
          user_id: userId,
        })
        .select()
        .single()

      if (error) {
        console.error('월간 일기 정리 생성 오류:', error)
        throw error
      }

      return data
    }
  } catch (error) {
    console.error('월간 일기 정리 저장 실패:', error)
    throw error
  }
}

/**
 * 월간 일기 정리 조회
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {Promise<Object|null>} 월간 일기 정리 또는 null
 */
export async function getMonthlyDiarySummary(year, month) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('monthly_diary_summaries')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('월간 일기 정리 조회 오류:', error)
      throw error
    }

    return data ? {
      ...data,
      summaryContent: data.summary_content,
    } : null
  } catch (error) {
    console.error('월간 일기 정리 조회 실패:', error)
    throw error
  }
}

