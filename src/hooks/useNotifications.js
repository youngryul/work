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
  const [isLoading, setIsLoading] = useState(true)

  const checkNotifications = useCallback(async () => {
    if (!user || !canUseNotifications) {
      setWeeklySummaryReminder({ isOpen: false, period: '', weekStart: null, weekEnd: null })
      setMonthlySummaryReminder({ isOpen: false, period: '', year: null, month: null })
      setPurchaseRequestReminder({ isOpen: false, count: 0 })
      setBacklogStaleReminder({ isOpen: false, tasks: [], message: '' })
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
      if (!alreadyShownBacklogStale) {
        const { tasks, message } = await fetchBacklogStaleReminderPayload()
        if (tasks.length > 0) {
          setBacklogStaleReminder({ isOpen: true, tasks, message })
        } else {
          setBacklogStaleReminder({ isOpen: false, tasks: [], message: '' })
        }
      } else {
        setBacklogStaleReminder({ isOpen: false, tasks: [], message: '' })
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
    isLoading,
    setWeeklySummaryReminder,
    setMonthlySummaryReminder,
    setPurchaseRequestReminder,
    setBacklogStaleReminder,
    refreshNotifications: checkNotifications,
  }
}
