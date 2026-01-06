import { useState, useEffect } from 'react'
import { getDiaryByDate } from '../services/diaryService.js'
import { hasDiaryReminderToday } from '../services/diaryReminderService.js'
import { hasSummaryReminderToday } from '../services/summaryReminderService.js'
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
  const [isLoading, setIsLoading] = useState(true)

  /**
   * 알림 상태 확인 및 업데이트
   */
  const checkNotifications = async () => {
    setIsLoading(true)
    try {
      // 일기 리마인더 확인
      const alreadyShownDiary = await hasDiaryReminderToday()
      // DB에서 이미 표시된 경우 상태를 명시적으로 false로 설정
      if (alreadyShownDiary) {
        setDiaryReminder({ isOpen: false, yesterdayDate: null })
      } else {
        const yesterday = getYesterdayDateString()
        const diary = await getDiaryByDate(yesterday)
        if (!diary) {
          setDiaryReminder({ isOpen: true, yesterdayDate: yesterday })
        } else {
          // 어제 일기가 이미 있으면 리마인더를 표시하지 않음
          setDiaryReminder({ isOpen: false, yesterdayDate: null })
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
      } else {
        setWeeklySummaryReminder({ isOpen: false, period: '', weekStart: null, weekEnd: null })
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
      } else {
        setMonthlySummaryReminder({ isOpen: false, period: '', year: null, month: null })
      }
    } catch (error) {
      console.error('알림 확인 오류:', error)
      // 에러 발생 시에도 상태를 명시적으로 설정
      setDiaryReminder({ isOpen: false, yesterdayDate: null })
    } finally {
      setIsLoading(false)
    }
  }

  // 컴포넌트 마운트 시 및 주기적으로 알림 확인
  useEffect(() => {
    checkNotifications()
    
    // 5분마다 알림 상태 확인
    const interval = setInterval(checkNotifications, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  return {
    diaryReminder,
    weeklySummaryReminder,
    monthlySummaryReminder,
    isLoading,
    setDiaryReminder,
    setWeeklySummaryReminder,
    setMonthlySummaryReminder,
    refreshNotifications: checkNotifications,
  }
}

