import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { getDiaryByDate } from '../services/diaryService.js'
import { hasDiaryReminderToday } from '../services/diaryReminderService.js'
import { hasSummaryReminderToday } from '../services/summaryReminderService.js'
import { hasFiveYearQuestionReminderToday } from '../services/fiveYearQuestionReminderService.js'
import { getQuestionAndAnswersByDate } from '../services/fiveYearQuestionService.js'
import { 
  shouldShowWeeklyReminder, 
  shouldShowMonthlyReminder, 
  getLastWeekInfo, 
  getLastMonthInfo 
} from '../utils/summaryReminder.js'

/**
 * 어제 날짜를 YYYY-MM-DD 형식으로 반환
 */
const getYesterdayDateString = () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const year = yesterday.getFullYear()
  const month = String(yesterday.getMonth() + 1).padStart(2, '0')
  const day = String(yesterday.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 알림 상태를 관리하는 커스텀 훅
 */
export function useNotifications() {
  const { user } = useAuth()
  const [diaryReminder, setDiaryReminder] = useState({ isOpen: false, yesterdayDate: null })
  const [weeklySummaryReminder, setWeeklySummaryReminder] = useState({ 
    isOpen: false, 
    period: '',
    weekStart: null,
    weekEnd: null,
  })
  const [monthlySummaryReminder, setMonthlySummaryReminder] = useState({ 
    isOpen: false, 
    period: '',
    year: null,
    month: null,
  })
  const [fiveYearQuestionReminder, setFiveYearQuestionReminder] = useState({ 
    isOpen: false, 
    todayDate: null,
    question: null,
  })
  const [isLoading, setIsLoading] = useState(true)

  /**
   * 알림 상태 확인 및 업데이트
   */
  const checkNotifications = useCallback(async () => {
    // 사용자가 없으면 알림 확인하지 않음
    if (!user) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      // 일기 리마인더 확인
      const alreadyShownDiary = await hasDiaryReminderToday()
      if (!alreadyShownDiary) {
        const yesterday = getYesterdayDateString()
        const diary = await getDiaryByDate(yesterday)
        if (!diary) {
          setDiaryReminder({ isOpen: true, yesterdayDate: yesterday })
        }
      }

      // 주간 요약 리마인더 확인
      const alreadyShownWeekly = await hasSummaryReminderToday('weekly')
      if (!alreadyShownWeekly && await shouldShowWeeklyReminder()) {
        const lastWeek = getLastWeekInfo()
        setWeeklySummaryReminder({ 
          isOpen: true, 
          period: lastWeek.period,
          weekStart: lastWeek.weekStart,
          weekEnd: lastWeek.weekEnd,
        })
      }

      // 월간 요약 리마인더 확인
      const alreadyShownMonthly = await hasSummaryReminderToday('monthly')
      if (!alreadyShownMonthly && await shouldShowMonthlyReminder()) {
        const lastMonth = getLastMonthInfo()
        setMonthlySummaryReminder({ 
          isOpen: true, 
          period: lastMonth.period,
          year: lastMonth.year,
          month: lastMonth.month,
        })
      }

      // 5년 질문 일기 리마인더 확인
      const alreadyShownFiveYear = await hasFiveYearQuestionReminderToday()
      if (!alreadyShownFiveYear) {
        const today = new Date()
        const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        const { question, answers } = await getQuestionAndAnswersByDate(today)
        // 오늘 질문에 대한 올해 답변이 없으면 리마인더 표시
        if (question) {
          const currentYear = today.getFullYear()
          const hasAnswerForToday = answers.some(answer => answer.year === currentYear)
          if (!hasAnswerForToday) {
            setFiveYearQuestionReminder({ 
              isOpen: true, 
              todayDate: todayDateString,
              question: question,
            })
          }
        }
      }
    } catch (error) {
      console.error('알림 확인 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // 사용자가 변경될 때만 알림 확인 (재로그인 시 중복 확인 방지)
  useEffect(() => {
    // 사용자가 없으면 알림 상태 초기화
    if (!user) {
      setDiaryReminder({ isOpen: false, yesterdayDate: null })
      setWeeklySummaryReminder({ isOpen: false, period: '', weekStart: null, weekEnd: null })
      setMonthlySummaryReminder({ isOpen: false, period: '', year: null, month: null })
      setFiveYearQuestionReminder({ isOpen: false, todayDate: null, question: null })
      setIsLoading(false)
      return
    }

    // 사용자가 있으면 알림 확인
    checkNotifications()
    
    // 5분마다 알림 상태 확인
    const interval = setInterval(checkNotifications, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [user?.id, checkNotifications]) // 사용자 ID가 변경될 때만 실행

  return {
    diaryReminder,
    weeklySummaryReminder,
    monthlySummaryReminder,
    fiveYearQuestionReminder,
    isLoading,
    setDiaryReminder,
    setWeeklySummaryReminder,
    setMonthlySummaryReminder,
    setFiveYearQuestionReminder,
    refreshNotifications: checkNotifications,
  }
}

