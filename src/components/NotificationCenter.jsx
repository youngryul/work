import { useState, useEffect } from 'react'
import { createTask } from '../services/taskService.js'
import { getDefaultCategory } from '../services/categoryService.js'
import { markDiaryReminderShown } from '../services/diaryReminderService.js'
import { markSummaryReminderShown } from '../services/summaryReminderService.js'

/**
 * 알림 타입 정의
 */
export const NOTIFICATION_TYPES = {
  DIARY: 'diary',
  WEEKLY_SUMMARY: 'weekly_summary',
  MONTHLY_SUMMARY: 'monthly_summary',
}

/**
 * 알림 센터 컴포넌트
 * 오른쪽 하단에 알림 버튼과 알림 목록을 표시
 */
export default function NotificationCenter({
  diaryReminder,
  weeklySummaryReminder,
  monthlySummaryReminder,
  onDiaryReminderClose,
  onWeeklySummaryGenerate,
  onMonthlySummaryGenerate,
  onDiaryWritten,
  onShowDiaryForm,
  onWeeklySummaryClose,
  onMonthlySummaryClose,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // 알림 개수 계산
  useEffect(() => {
    let count = 0
    if (diaryReminder?.isOpen) count++
    if (weeklySummaryReminder?.isOpen) count++
    if (monthlySummaryReminder?.isOpen) count++
    setUnreadCount(count)
  }, [diaryReminder?.isOpen, weeklySummaryReminder?.isOpen, monthlySummaryReminder?.isOpen])

  // 알림 목록 토글
  const toggleNotifications = () => {
    setIsOpen(!isOpen)
  }

  // 알림 목록 닫기
  const handleClose = () => {
    setIsOpen(false)
  }

  // 알림이 있으면 자동으로 열기
  useEffect(() => {
    if (unreadCount > 0 && !isOpen) {
      setIsOpen(true)
    }
  }, [unreadCount])

  const hasNotifications = unreadCount > 0

  return (
    <>
      {/* 알림 버튼 (플로팅 버튼) - SummaryQuickAction 위에 배치 - 알림이 있을 때만 표시 */}
      {hasNotifications && (
        <button
          onClick={toggleNotifications}
          className="fixed bottom-24 right-6 w-14 h-14 bg-pink-500 text-white rounded-full shadow-lg hover:bg-pink-600 transition-all duration-200 flex items-center justify-center z-50"
          aria-label="알림"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* 알림 목록 패널 */}
      {isOpen && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 bg-black bg-opacity-20 z-40"
            onClick={handleClose}
          />
          
          {/* 알림 목록 */}
          <div className="fixed bottom-40 right-6 w-80 bg-white rounded-lg shadow-2xl z-50 max-h-[60vh] overflow-hidden flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 font-sans">
                알림 ({unreadCount})
              </h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            {/* 알림 목록 */}
            <div className="flex-1 overflow-y-auto">
              {!hasNotifications ? (
                <div className="p-8 text-center text-gray-500 font-sans">
                  알림이 없습니다
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {/* 일기 리마인더 알림 */}
                  {diaryReminder?.isOpen && (
                    <div className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-pink-500 rounded-full mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 font-sans mb-1">
                            어제 일기를 작성하세요
                          </p>
                          <p className="text-xs text-gray-600 font-sans mb-3">
                            {diaryReminder.yesterdayDate && 
                              new Date(diaryReminder.yesterdayDate + 'T00:00:00').toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                weekday: 'short'
                              })
                            }의 일기를 작성해주세요.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (onShowDiaryForm) {
                                  onShowDiaryForm(true)
                                }
                                handleClose()
                              }}
                              className="px-3 py-1.5 bg-pink-400 text-white text-xs rounded-lg hover:bg-pink-500 transition-colors font-sans"
                            >
                              지금 작성하기
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const defaultCategory = await getDefaultCategory()
                                  const yesterdayDate = diaryReminder.yesterdayDate
                                  if (yesterdayDate) {
                                    const date = new Date(yesterdayDate + 'T00:00:00')
                                    const formattedDate = date.toLocaleDateString('ko-KR', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      weekday: 'short'
                                    })
                                    await createTask(`${formattedDate} 일기 작성`, defaultCategory, true)
                                  }
                                  // 리마인더 표시 기록
                                  await markDiaryReminderShown()
                                  onDiaryReminderClose()
                                  handleClose()
                                  // 오늘 할일 화면 새로고침
                                  window.dispatchEvent(new CustomEvent('refreshTodayTasks'))
                                } catch (error) {
                                  console.error('할 일 추가 실패:', error)
                                  alert('할 일 추가에 실패했습니다.')
                                }
                              }}
                              className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50 transition-colors font-sans"
                            >
                              나중에
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 주간 요약 알림 */}
                  {weeklySummaryReminder?.isOpen && (
                    <div className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 font-sans mb-1">
                            주간 업무/일기 요약을 생성하세요
                          </p>
                          <p className="text-xs text-gray-600 font-sans mb-3">
                            {weeklySummaryReminder.period}의 업무일지와 일기를 정리하여 요약을 생성해주세요.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                onWeeklySummaryGenerate()
                                handleClose()
                              }}
                              className="px-3 py-1.5 bg-indigo-500 text-white text-xs rounded-lg hover:bg-indigo-600 transition-colors font-sans"
                            >
                              지금 생성하기
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const defaultCategory = await getDefaultCategory()
                                  await createTask(
                                    `주간 업무/일기 요약 생성 (${weeklySummaryReminder.period})`,
                                    defaultCategory,
                                    true
                                  )
                                  // 리마인더 표시 기록
                                  await markSummaryReminderShown('weekly')
                                  if (onWeeklySummaryClose) {
                                    onWeeklySummaryClose()
                                  }
                                  handleClose()
                                  // 오늘 할일 화면 새로고침
                                  window.dispatchEvent(new CustomEvent('refreshTodayTasks'))
                                } catch (error) {
                                  console.error('할 일 추가 실패:', error)
                                  alert('할 일 추가에 실패했습니다.')
                                }
                              }}
                              className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50 transition-colors font-sans"
                            >
                              나중에
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 월간 요약 알림 */}
                  {monthlySummaryReminder?.isOpen && (
                    <div className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 font-sans mb-1">
                            월간 업무/일기 요약을 생성하세요
                          </p>
                          <p className="text-xs text-gray-600 font-sans mb-3">
                            {monthlySummaryReminder.period}의 업무일지와 일기를 정리하여 요약을 생성해주세요.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                onMonthlySummaryGenerate()
                                handleClose()
                              }}
                              className="px-3 py-1.5 bg-indigo-500 text-white text-xs rounded-lg hover:bg-indigo-600 transition-colors font-sans"
                            >
                              지금 생성하기
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const defaultCategory = await getDefaultCategory()
                                  await createTask(
                                    `월간 업무/일기 요약 생성 (${monthlySummaryReminder.period})`,
                                    defaultCategory,
                                    true
                                  )
                                  // 리마인더 표시 기록
                                  await markSummaryReminderShown('monthly')
                                  if (onMonthlySummaryClose) {
                                    onMonthlySummaryClose()
                                  }
                                  handleClose()
                                  // 오늘 할일 화면 새로고침
                                  window.dispatchEvent(new CustomEvent('refreshTodayTasks'))
                                } catch (error) {
                                  console.error('할 일 추가 실패:', error)
                                  alert('할 일 추가에 실패했습니다.')
                                }
                              }}
                              className="px-3 py-1.5 border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50 transition-colors font-sans"
                            >
                              나중에
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

