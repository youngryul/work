import { useState, useEffect } from 'react'
import { createTravel, updateTravel, getTravelById } from '../../services/travelService.js'
import { COMPANION_TYPE, COMPANION_TYPE_LABEL, PROVINCES, COMMON_TRAVEL_PURPOSE_TAGS, DEFAULT_EMOTION_TAGS } from '../../constants/travelConstants.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'

/**
 * 여행 등록/수정 폼 컴포넌트
 */
export default function TravelForm({ initialData, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    endDate: '',
    province: '',
    city: '',
    companionType: COMPANION_TYPE.ALONE,
    satisfactionScore: null,
    oneLineReview: '',
    isPublic: false,
    isFavorite: false,
    tags: [],
    emotions: [],
  })
  const [newTag, setNewTag] = useState('')
  const [newEmotion, setNewEmotion] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      loadTravelData()
    } else {
      // 새 여행일 경우 오늘 날짜를 기본값으로 설정
      const today = new Date().toISOString().split('T')[0]
      setFormData(prev => ({
        ...prev,
        startDate: today,
        endDate: today,
      }))
    }
  }, [initialData])

  const loadTravelData = async () => {
    if (!initialData?.id) return

    setIsLoading(true)
    try {
      const travel = await getTravelById(initialData.id)
      if (travel) {
        setFormData({
          title: travel.title || '',
          startDate: travel.startDate || '',
          endDate: travel.endDate || '',
          province: travel.province || '',
          city: travel.city || '',
          companionType: travel.companionType || COMPANION_TYPE.ALONE,
          satisfactionScore: travel.satisfactionScore || null,
          oneLineReview: travel.oneLineReview || '',
          isPublic: travel.isPublic || false,
          isFavorite: travel.isFavorite || false,
          tags: travel.tags || [],
          emotions: travel.emotions || [],
        })
      }
    } catch (error) {
      console.error('여행 데이터 로드 오류:', error)
      showToast('여행 데이터를 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      showToast('제목을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    if (!formData.startDate || !formData.endDate) {
      showToast('여행 기간을 설정해주세요.', TOAST_TYPES.ERROR)
      return
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      showToast('종료일은 시작일보다 늦어야 합니다.', TOAST_TYPES.ERROR)
      return
    }

    if (!formData.province) {
      showToast('지역을 선택해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      if (initialData?.id) {
        await updateTravel(initialData.id, formData)
        showToast('여행 기록이 수정되었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await createTravel(formData)
        showToast('여행 기록이 추가되었습니다.', TOAST_TYPES.SUCCESS)
      }
      onSave()
    } catch (error) {
      console.error('여행 저장 오류:', error)
      showToast(error.message || '저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }))
      setNewTag('')
    }
  }

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }))
  }

  const handleAddCommonTag = (tag) => {
    if (!formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
      }))
    }
  }

  const handleAddEmotion = () => {
    if (newEmotion.trim() && !formData.emotions.includes(newEmotion.trim())) {
      setFormData(prev => ({
        ...prev,
        emotions: [...prev.emotions, newEmotion.trim()],
      }))
      setNewEmotion('')
    }
  }

  const handleRemoveEmotion = (emotion) => {
    setFormData(prev => ({
      ...prev,
      emotions: prev.emotions.filter(e => e !== emotion),
    }))
  }

  const handleAddCommonEmotion = (emotion) => {
    if (!formData.emotions.includes(emotion)) {
      setFormData(prev => ({
        ...prev,
        emotions: [...prev.emotions, emotion],
      }))
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-500 text-xl">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">
        {initialData ? '여행 수정' : '새 여행 추가'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 제목 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            여행 제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder="예: 제주도 3박 4일 여행"
            required
          />
        </div>

        {/* 여행 기간 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              시작일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              required
            />
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              종료일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              min={formData.startDate}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              required
            />
          </div>
        </div>

        {/* 지역 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              시/도 <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.province}
              onChange={(e) => setFormData({ ...formData, province: e.target.value, city: '' })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              required
            >
              <option value="">선택하세요</option>
              {PROVINCES.map(province => (
                <option key={province} value={province}>{province}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-base font-medium text-gray-700 mb-2">
              시/군/구 (선택사항)
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              placeholder="예: 제주시"
            />
          </div>
        </div>

        {/* 동행 유형 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            동행 유형
          </label>
          <select
            value={formData.companionType}
            onChange={(e) => setFormData({ ...formData, companionType: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
          >
            {Object.entries(COMPANION_TYPE_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* 여행 목적 태그 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            여행 목적 태그
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.tags.map(tag => (
              <span
                key={tag}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              placeholder="태그 입력 후 Enter"
            />
            <button
              type="button"
              onClick={handleAddTag}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              추가
            </button>
          </div>
          <div className="text-sm text-gray-500 mb-2">자주 사용하는 태그:</div>
          <div className="flex flex-wrap gap-2">
            {COMMON_TRAVEL_PURPOSE_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAddCommonTag(tag)}
                disabled={formData.tags.includes(tag)}
                className={`px-3 py-1 rounded-full text-sm ${
                  formData.tags.includes(tag)
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>

        {/* 감정 태그 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            감정 태그
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.emotions.map(emotion => (
              <span
                key={emotion}
                className="px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm flex items-center gap-2"
              >
                {emotion}
                <button
                  type="button"
                  onClick={() => handleRemoveEmotion(emotion)}
                  className="text-pink-600 hover:text-pink-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newEmotion}
              onChange={(e) => setNewEmotion(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmotion())}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              placeholder="감정 입력 후 Enter"
            />
            <button
              type="button"
              onClick={handleAddEmotion}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              추가
            </button>
          </div>
          <div className="text-sm text-gray-500 mb-2">자주 사용하는 감정:</div>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_EMOTION_TAGS.map(emotion => (
              <button
                key={emotion}
                type="button"
                onClick={() => handleAddCommonEmotion(emotion)}
                disabled={formData.emotions.includes(emotion)}
                className={`px-3 py-1 rounded-full text-sm ${
                  formData.emotions.includes(emotion)
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                + {emotion}
              </button>
            ))}
          </div>
        </div>

        {/* 만족도 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            만족도 (1-5점)
          </label>
          <div className="flex items-center gap-4">
            {[1, 2, 3, 4, 5].map(score => (
              <button
                key={score}
                type="button"
                onClick={() => setFormData({ ...formData, satisfactionScore: formData.satisfactionScore === score ? null : score })}
                className={`w-12 h-12 rounded-full text-xl font-bold transition-colors ${
                  formData.satisfactionScore === score
                    ? 'bg-yellow-400 text-white'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {score}
              </button>
            ))}
            {formData.satisfactionScore && (
              <span className="text-gray-600">
                {formData.satisfactionScore}점 선택됨
              </span>
            )}
          </div>
        </div>

        {/* 한줄 회고 */}
        <div>
          <label className="block text-base font-medium text-gray-700 mb-2">
            한줄 회고
          </label>
          <textarea
            value={formData.oneLineReview}
            onChange={(e) => setFormData({ ...formData, oneLineReview: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
            placeholder="이 여행에 대한 한줄 회고를 작성해보세요"
            rows={3}
          />
        </div>

        {/* 공개/비공개 */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isPublic}
              onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-base text-gray-700">공개 설정</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isFavorite}
              onChange={(e) => setFormData({ ...formData, isFavorite: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-base text-gray-700">즐겨찾기</span>
          </label>
        </div>

        {/* 버튼 */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors duration-200 text-base font-medium"
          >
            취소
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 text-base font-medium"
          >
            {initialData ? '수정' : '추가'}
          </button>
        </div>
      </form>
    </div>
  )
}
