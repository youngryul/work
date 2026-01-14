/**
 * 월별 회고 폼 컴포넌트
 * 월말 회고 작성 (다음 달 목표 등록 필수 조건)
 */
import { useState, useEffect } from 'react'
import { getMonthlyReflection, saveMonthlyReflection } from '../../services/goalService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {Function} onSave - 저장 완료 핸들러
 */
export default function MonthlyReflectionForm({ year, month, onSave }) {
  const [formData, setFormData] = useState({
    achievementRate: 0,
    bestChoice: '',
    failureReason: '',
    keepNextMonth: '',
    dropNextMonth: '',
    reflectionText: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 기존 회고 로드
  useEffect(() => {
    loadReflection()
  }, [year, month])

  const loadReflection = async () => {
    try {
      setLoading(true)
      const reflection = await getMonthlyReflection(year, month)
      if (reflection) {
        setFormData({
          achievementRate: reflection.achievementRate || 0,
          bestChoice: reflection.bestChoice || '',
          failureReason: reflection.failureReason || '',
          keepNextMonth: reflection.keepNextMonth || '',
          dropNextMonth: reflection.dropNextMonth || '',
          reflectionText: reflection.reflectionText || '',
        })
      }
    } catch (error) {
      console.error('회고 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // 필수 필드 검증
    if (!formData.bestChoice.trim() || !formData.failureReason.trim()) {
      showToast('모든 필수 항목을 작성해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      setSaving(true)
      await saveMonthlyReflection({
        year,
        month,
        ...formData,
      })
      showToast('회고가 저장되었습니다. 이제 다음 달 목표를 등록할 수 있습니다.', TOAST_TYPES.SUCCESS)
      onSave?.()
    } catch (error) {
      console.error('회고 저장 실패:', error)
      showToast('회고 저장에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500 font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-400 mx-auto mb-2"></div>
        <p>로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-pink-200 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 font-sans">
          {year}년 {month}월 회고
        </h2>
        <p className="text-sm text-gray-600 font-sans">
          회고를 작성해야 다음 달 목표를 등록할 수 있습니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 달성률 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
            이번 달 목표 달성률 *
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={formData.achievementRate}
              onChange={(e) => updateField('achievementRate', parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="text-xl font-bold text-pink-600 font-sans w-16 text-right">
              {formData.achievementRate}%
            </span>
          </div>
        </div>

        {/* 가장 잘한 선택 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
            가장 잘한 선택 *
          </label>
          <textarea
            value={formData.bestChoice}
            onChange={(e) => updateField('bestChoice', e.target.value)}
            placeholder="이번 달 가장 잘한 선택이나 행동을 작성해주세요..."
            className="w-full h-24 p-4 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans resize-none"
            required
          />
        </div>

        {/* 실패 원인 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
            실패 원인 분석 (의지 vs 환경) *
          </label>
          <textarea
            value={formData.failureReason}
            onChange={(e) => updateField('failureReason', e.target.value)}
            placeholder="목표를 달성하지 못한 이유를 분석해주세요. 의지 부족인지, 환경 문제인지 구분해보세요..."
            className="w-full h-24 p-4 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans resize-none"
            required
          />
        </div>

        {/* 다음 달 유지할 것 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
            다음 달 유지할 것
          </label>
          <textarea
            value={formData.keepNextMonth}
            onChange={(e) => updateField('keepNextMonth', e.target.value)}
            placeholder="이번 달 효과적이었던 방법이나 습관을 작성해주세요..."
            className="w-full h-20 p-4 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans resize-none"
          />
        </div>

        {/* 다음 달 버릴 것 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
            다음 달 버릴 것
          </label>
          <textarea
            value={formData.dropNextMonth}
            onChange={(e) => updateField('dropNextMonth', e.target.value)}
            placeholder="효과가 없었거나 개선이 필요한 부분을 작성해주세요..."
            className="w-full h-20 p-4 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans resize-none"
          />
        </div>

        {/* 자유 회고 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
            자유 회고
          </label>
          <textarea
            value={formData.reflectionText}
            onChange={(e) => updateField('reflectionText', e.target.value)}
            placeholder="이번 달에 대한 자유로운 생각을 작성해주세요..."
            className="w-full h-32 p-4 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans resize-none"
          />
        </div>

        {/* 저장 버튼 */}
        <div className="flex justify-end pt-4 border-t-2 border-pink-200">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors text-base font-medium shadow-md font-sans disabled:opacity-50"
          >
            {saving ? '저장 중...' : '회고 저장'}
          </button>
        </div>
      </form>
    </div>
  )
}

