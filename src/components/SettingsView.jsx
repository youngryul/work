import { useState, useEffect } from 'react'
import { getNotificationSettings, saveNotificationSettings } from '../services/notificationSettingsService.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * 설정 화면 컴포넌트
 */
export default function SettingsView({ currentTheme = 'posily', onThemeChange }) {
  const [settings, setSettings] = useState({
    diaryEnabled: true,
    weeklySummaryEnabled: true,
    monthlySummaryEnabled: true,
    fiveYearQuestionEnabled: true,
  })
  const [activeTab, setActiveTab] = useState('notification')
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

      <div className="mb-6 flex gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('notification')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'notification' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          🔔 알림 설정
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('theme')}
          className={`px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'theme' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
        >
          🎨 테마 설정
        </button>
      </div>

      {activeTab === 'notification' && (
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
      )}

      {activeTab === 'theme' && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">테마 설정</h2>
          <p className="text-sm text-gray-600 mb-6">원하는 앱 분위기를 선택하세요.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => {
                onThemeChange?.('posily')
                showToast('포실이 테마로 변경되었습니다.', TOAST_TYPES.SUCCESS)
              }}
              className={`text-left rounded-xl border-2 p-4 transition-all ${currentTheme === 'posily' ? 'border-pink-400 ring-2 ring-pink-200' : 'border-gray-200 hover:border-pink-300'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <img
                    src="/images/포실이.png"
                    alt="포실이(투명)"
                    className="w-8 h-8 object-contain"
                  />
                  <h3 className="text-lg font-semibold text-gray-800">포실이 테마</h3>
                </div>
                {currentTheme === 'posily' && <span className="text-xs px-2 py-1 rounded bg-pink-100 text-pink-700">선택됨</span>}
              </div>
              <div
                className="h-20 rounded-lg border border-pink-200 bg-cover bg-center"
                style={{ backgroundImage: 'url(/images/심플배경화면.png)' }}
              />
              <p className="text-sm text-gray-600 mt-3">기존처럼 배경 이미지를 사용하는 감성 테마</p>
            </button>

            <button
              type="button"
              onClick={() => {
                onThemeChange?.('blue')
                showToast('파란색 심플 테마로 변경되었습니다.', TOAST_TYPES.SUCCESS)
              }}
              className={`text-left rounded-xl border-2 p-4 transition-all ${currentTheme === 'blue' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">💙 파란색 테마</h3>
                {currentTheme === 'blue' && <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">선택됨</span>}
              </div>
              <div className="h-20 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-100 to-blue-300" />
              <p className="text-sm text-gray-600 mt-3">이미지 없이 심플한 블루 톤 테마</p>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
