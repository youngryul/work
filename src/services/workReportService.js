/**
 * 업무일지 AI 요약 서비스
 * 완료한 할일들을 업무일지 형태로 요약 및 정리
 */

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

