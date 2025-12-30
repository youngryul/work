import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { createRecord, updateRecord } from '../services/recordService.js'

/**
 * 기록 작성/수정 폼 컴포넌트
 * @param {Object|null} initialRecord - 초기 기록 데이터 (수정 모드)
 * @param {Function} onSave - 저장 완료 핸들러
 * @param {Function} onCancel - 취소 핸들러
 */
export default function RecordForm({ initialRecord = null, onSave, onCancel }) {
  const isEditMode = !!initialRecord

  // 폼 상태
  const [formData, setFormData] = useState({
    projectName: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    content: '',
  })

  // 초기 데이터 로드
  useEffect(() => {
    if (initialRecord) {
      // 기존 데이터에서 content 생성 (background를 우선 사용, 없으면 content 사용)
      const existingContent = initialRecord.content || initialRecord.background || ''

      setFormData({
        projectName: initialRecord.projectName || initialRecord.projectname || '',
        date: initialRecord.date || format(new Date(), 'yyyy-MM-dd'),
        title: initialRecord.title || '',
        content: existingContent,
      })
    }
  }, [initialRecord])

  // 폼 필드 업데이트
  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // 저장
  const handleSubmit = async (e) => {
    e.preventDefault()

    // 유효성 검사
    if (!formData.projectName.trim()) {
      alert('프로젝트명을 입력해주세요.')
      return
    }
    if (!formData.title.trim()) {
      alert('제목을 입력해주세요.')
      return
    }

    try {
      const dataToSave = {
        projectName: formData.projectName,
        date: formData.date,
        title: formData.title,
        content: formData.content,
        background: null,
        discussion: null,
        problem: null,
        decision: null,
        actionItems: [],
      }

      if (isEditMode) {
        await updateRecord(initialRecord.id, dataToSave)
      } else {
        await createRecord(dataToSave)
      }

      // 저장 완료 이벤트 발생
      window.dispatchEvent(new CustomEvent('recordSaved'))

      onSave?.()
    } catch (error) {
      console.error('기록 저장 실패:', error)
      alert('기록 저장에 실패했습니다.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-md border-2 border-pink-200 p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 font-sans">
            {isEditMode ? '기록 수정' : '새 기록 작성'}
          </h1>
          <p className="text-base text-gray-600 font-sans">
            {isEditMode ? '기록을 수정해주세요' : '새로운 기록을 작성해주세요'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 border-b-2 border-pink-200 pb-2 font-sans">
              기본 정보
            </h2>

            {/* 프로젝트명 */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                프로젝트명 *
              </label>
              <input
                type="text"
                value={formData.projectName}
                onChange={(e) => updateField('projectName', e.target.value)}
                required
                className="w-full px-3 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
              />
            </div>

            {/* 작성일 */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                작성일 *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => updateField('date', e.target.value)}
                required
                className="w-full px-3 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
              />
            </div>

            {/* 제목 */}
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                제목 *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                required
                className="w-full px-3 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans"
              />
            </div>
          </div>

          {/* 본문 내용 */}
          <div className="space-y-4">
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                내용
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => updateField('content', e.target.value)}
                placeholder="기록 내용을 입력하세요..."
                rows={12}
                className="w-full px-3 py-2 border-2 border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-base bg-white font-sans resize-y"
              />
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-4 justify-end pt-4 border-t-2 border-pink-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border-2 border-pink-200 rounded-lg text-gray-700 hover:bg-pink-50 transition-colors text-base font-medium shadow-md font-sans"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-pink-400 text-white rounded-lg hover:bg-pink-500 transition-colors text-base font-medium shadow-md font-sans"
            >
              {isEditMode ? '수정' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
