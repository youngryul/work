/**
 * 주간/월간 요약 생성 리마인더 유틸리티
 * DB 기반으로 변경됨 (summaryReminderService.js 사용)
 */

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
export function getTodayDateString() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 오늘이 월요일인지 확인
 */
export function isMonday() {
  const today = new Date()
  return today.getDay() === 1 // 0: 일요일, 1: 월요일
}

/**
 * 오늘이 매월 1일인지 확인
 */
export function isFirstDayOfMonth() {
  const today = new Date()
  return today.getDate() === 1
}

/**
 * 주간 요약 리마인더를 표시해야 하는지 확인 (비동기 - DB 확인)
 * @returns {Promise<boolean>}
 */
export async function shouldShowWeeklyReminder() {
  if (!isMonday()) {
    return false
  }

  // DB에서 오늘 리마인더 표시 여부 확인
  const { hasSummaryReminderToday } = await import('../services/summaryReminderService.js')
  const alreadyShown = await hasSummaryReminderToday('weekly')
  
  return !alreadyShown
}

/**
 * 월간 요약 리마인더를 표시해야 하는지 확인 (비동기 - DB 확인)
 * @returns {Promise<boolean>}
 */
export async function shouldShowMonthlyReminder() {
  if (!isFirstDayOfMonth()) {
    return false
  }

  // DB에서 오늘 리마인더 표시 여부 확인
  const { hasSummaryReminderToday } = await import('../services/summaryReminderService.js')
  const alreadyShown = await hasSummaryReminderToday('monthly')
  
  return !alreadyShown
}

/**
 * 주간 요약 리마인더 표시 완료 처리 (DB 저장)
 * @returns {Promise<void>}
 */
export async function markWeeklyReminderShown() {
  const { markSummaryReminderShown } = await import('../services/summaryReminderService.js')
  await markSummaryReminderShown('weekly')
}

/**
 * 월간 요약 리마인더 표시 완료 처리 (DB 저장)
 * @returns {Promise<void>}
 */
export async function markMonthlyReminderShown() {
  const { markSummaryReminderShown } = await import('../services/summaryReminderService.js')
  await markSummaryReminderShown('monthly')
}

/**
 * 지난 주 정보 가져오기 (월요일 기준)
 */
export function getLastWeekInfo() {
  const today = new Date()
  const dayOfWeek = today.getDay()
  
  // 오늘이 월요일이면 지난 주의 월요일과 일요일
  // 오늘이 월요일이 아니면 이번 주의 월요일을 기준으로 지난 주 계산
  let lastMonday
  if (dayOfWeek === 1) {
    // 오늘이 월요일이면 7일 전이 지난 주 월요일
    lastMonday = new Date(today)
    lastMonday.setDate(today.getDate() - 7)
  } else {
    // 오늘이 월요일이 아니면 가장 가까운 지난 월요일
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    lastMonday = new Date(today)
    lastMonday.setDate(today.getDate() - daysToMonday - 7)
  }
  
  const lastSunday = new Date(lastMonday)
  lastSunday.setDate(lastMonday.getDate() + 6)
  
  const formatDate = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  return {
    weekStart: formatDate(lastMonday),
    weekEnd: formatDate(lastSunday),
    period: `${lastMonday.getFullYear()}년 ${lastMonday.getMonth() + 1}월 ${lastMonday.getDate()}일 ~ ${lastSunday.getFullYear()}년 ${lastSunday.getMonth() + 1}월 ${lastSunday.getDate()}일`
  }
}

/**
 * 지난 달 정보 가져오기
 */
export function getLastMonthInfo() {
  const today = new Date()
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  
  return {
    year: lastMonth.getFullYear(),
    month: lastMonth.getMonth() + 1,
    period: `${lastMonth.getFullYear()}년 ${lastMonth.getMonth() + 1}월`
  }
}

