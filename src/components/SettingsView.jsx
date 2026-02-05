import { useState, useEffect } from 'react'
import { getNotificationSettings, saveNotificationSettings } from '../services/notificationSettingsService.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * 설정 화면 컴포넌트
 */
export default function SettingsView() {
  const [settings, setSettings] = useState({
    diaryEnabled: true,
    weeklySummaryEnabled: true,
    monthlySummaryEnabled: true,
    fiveYearQuestionEnabled: true,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setIsLoading(true)
    try {
      const loadedSettings = await getNotificationSettings()
      setSettings(loadedSettings)
    } catch (error) {
      console.error('설정 로드 오류:', error)
      showToast('설정을 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async (key) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key],
    }
    setSettings(newSettings)

    setIsSaving(true)
    try {
      await saveNotificationSettings(newSettings)
      showToast('설정이 저장되었습니다.', TOAST_TYPES.SUCCESS)
    } catch (error) {
      console.error('설정 저장 오류:', error)
      showToast('설정 저장에 실패했습니다.', TOAST_TYPES.ERROR)
      // 실패 시 원래 값으로 복구
      await loadSettings()
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12 text-gray-500 text-2xl">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-handwriting text-gray-800 mb-2">
          설정
        </h1>
        <p className="text-xl text-gray-600">앱 설정을 관리하세요</p>
      </div>

      {/* 알림 설정 */}
      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">알림 설정</h2>
        
        <div className="space-y-4">
          {/* 일기 알림 */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">일기 알림</h3>
              <p className="text-sm text-gray-600">어제 일기를 작성하라는 알림을 받습니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.diaryEnabled}
                onChange={() => handleToggle('diaryEnabled')}
                disabled={isSaving}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* 주간 요약 알림 */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">주간 요약 알림</h3>
              <p className="text-sm text-gray-600">주간 업무/일기 요약 생성을 알려줍니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.weeklySummaryEnabled}
                onChange={() => handleToggle('weeklySummaryEnabled')}
                disabled={isSaving}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* 월간 요약 알림 */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">월간 요약 알림</h3>
              <p className="text-sm text-gray-600">월간 업무/일기 요약 생성을 알려줍니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.monthlySummaryEnabled}
                onChange={() => handleToggle('monthlySummaryEnabled')}
                disabled={isSaving}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* 5년 질문 알림 */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">5년 질문 알림</h3>
              <p className="text-sm text-gray-600">오늘의 5년 질문에 답하라는 알림을 받습니다</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.fiveYearQuestionEnabled}
                onChange={() => handleToggle('fiveYearQuestionEnabled')}
                disabled={isSaving}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
