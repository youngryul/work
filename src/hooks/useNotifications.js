import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { hasSummaryReminderToday } from '../services/summaryReminderService.js'
import { getNotificationSettings } from '../services/notificationSettingsService.js'
import { getPendingTokenPurchaseRequestCount } from '../services/aiTokenPurchaseService.js'
import {
  shouldShowWeeklyReminder,
  shouldShowMonthlyReminder,
  getLastWeekInfo,
  getLastMonthInfo,
} from '../utils/summaryReminder.js'
import {
  fetchBacklogStaleReminderPayload,
  hasBacklogStaleReminderToday,
} from '../services/backlogStaleReminderService.js'
import {
  fetchMonthlyGoalReminderPayload,
  hasMonthlyGoalReminderShown,
} from '../services/monthlyGoalReminderService.js'

/** 월별 목표 점검 알림 닫힌 상태 */
const CLOSED_MONTHLY_GOAL_REMINDER = { isOpen: false, payload: null }

/**
 * 알림 상태를 관리하는 커스텀 훅
 */
export function useNotifications() {
  const { user, userRole } = useAuth()
  const canUseNotifications = userRole === 'admin' || userRole === 'superuser'
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
  const [purchaseRequestReminder, setPurchaseRequestReminder] = useState({
    isOpen: false,
    count: 0,
  })
  const [backlogStaleReminder, setBacklogStaleReminder] = useState({
    isOpen: false,
    tasks: [],
    message: '',
  })
  // 월별 목표 10일 점검 (10일 · 20일 · 말일)
  const [monthlyGoalReminder, setMonthlyGoalReminder] = useState(CLOSED_MONTHLY_GOAL_REMINDER)
  const [isLoading, setIsLoading] = useState(true)

  const checkNotifications = useCallback(async () => {
    if (!user || !canUseNotifications) {
      setWeeklySummaryReminder({ isOpen: false, period: '', weekStart: null, weekEnd: null })
      setMonthlySummaryReminder({ isOpen: false, period: '', year: null, month: null })
      setPurchaseRequestReminder({ isOpen: false, count: 0 })
      setBacklogStaleReminder({ isOpen: false, tasks: [], message: '' })
      setMonthlyGoalReminder(CLOSED_MONTHLY_GOAL_REMINDER)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      if (!user?.id) {
        setIsLoading(false)
        return
      }

      const notificationSettings = await getNotificationSettings()

      if (notificationSettings.weeklySummaryEnabled) {
        const alreadyShownWeekly = await hasSummaryReminderToday('weekly', user.id)
        if (!alreadyShownWeekly && (await shouldShowWeeklyReminder())) {
          const lastWeek = getLastWeekInfo()
          setWeeklySummaryReminder({
            isOpen: true,
            period: lastWeek.period,
            weekStart: lastWeek.weekStart,
            weekEnd: lastWeek.weekEnd,
          })
        }
      } else {
        setWeeklySummaryReminder({ isOpen: false, period: '', weekStart: null, weekEnd: null })
      }

      if (notificationSettings.monthlySummaryEnabled) {
        const alreadyShownMonthly = await hasSummaryReminderToday('monthly', user.id)
        if (!alreadyShownMonthly && (await shouldShowMonthlyReminder())) {
          const lastMonth = getLastMonthInfo()
          setMonthlySummaryReminder({
            isOpen: true,
            period: lastMonth.period,
            year: lastMonth.year,
            month: lastMonth.month,
          })
        }
      } else {
        setMonthlySummaryReminder({ isOpen: false, period: '', year: null, month: null })
      }

      const alreadyShownBacklogStale = await hasBacklogStaleReminderToday(user.id)
      if (notificationSettings.backlogStaleEnabled && !alreadyShownBacklogStale) {
        const { tasks, message } = await fetchBacklogStaleReminderPayload()
        if (tasks.length > 0) {
          setBacklogStaleReminder({ isOpen: true, tasks, message })
        } else {
          setBacklogStaleReminder({ isOpen: false, tasks: [], message: '' })
        }
      } else {
        setBacklogStaleReminder({ isOpen: false, tasks: [], message: '' })
      }

      // 월별 목표 점검: 점검일이고, 아직 확인 안 했고, 이번 달 목표가 있을 때만
      const alreadyShownMonthlyGoal = await hasMonthlyGoalReminderShown(user.id)
      if (notificationSettings.monthlyGoalEnabled && !alreadyShownMonthlyGoal) {
        const payload = await fetchMonthlyGoalReminderPayload()
        setMonthlyGoalReminder(
          payload && payload.summary.totalCount > 0
            ? { isOpen: true, payload }
            : CLOSED_MONTHLY_GOAL_REMINDER,
        )
      } else {
        setMonthlyGoalReminder(CLOSED_MONTHLY_GOAL_REMINDER)
      }

      if (userRole === 'admin') {
        const pendingPurchaseCount = await getPendingTokenPurchaseRequestCount()
        setPurchaseRequestReminder({
          isOpen: pendingPurchaseCount > 0,
          count: pendingPurchaseCount,
        })
      } else {
        setPurchaseRequestReminder({ isOpen: false, count: 0 })
      }
    } catch (error) {
      console.error('알림 확인 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user, canUseNotifications, userRole])

  useEffect(() => {
    if (!user || !canUseNotifications) {
      setWeeklySummaryReminder({ isOpen: false, period: '', weekStart: null, weekEnd: null })
      setMonthlySummaryReminder({ isOpen: false, period: '', year: null, month: null })
      setPurchaseRequestReminder({ isOpen: false, count: 0 })
      setBacklogStaleReminder({ isOpen: false, tasks: [], message: '' })
      setMonthlyGoalReminder(CLOSED_MONTHLY_GOAL_REMINDER)
      setIsLoading(false)
      return
    }

    checkNotifications()
    const interval = setInterval(checkNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user?.id, canUseNotifications, checkNotifications])

  return {
    weeklySummaryReminder,
    monthlySummaryReminder,
    purchaseRequestReminder,
    backlogStaleReminder,
    monthlyGoalReminder,
    isLoading,
    setWeeklySummaryReminder,
    setMonthlySummaryReminder,
    setPurchaseRequestReminder,
    setBacklogStaleReminder,
    setMonthlyGoalReminder,
    refreshNotifications: checkNotifications,
  }
}
