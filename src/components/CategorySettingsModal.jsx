import { useState, useEffect } from 'react'
import { getCategories, getDefaultCategory, setDefaultCategory } from '../services/categoryService.js'
import { SYSTEM_CATEGORY_DAILY } from '../constants/categories.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * 카테고리 설정 모달
 * 기본 카테고리를 선택할 수 있는 팝업
 * @param {boolean} isOpen - 모달 열림 여부
 * @param {Function} onClose - 닫기 핸들러
 */
export default function CategorySettingsModal({ isOpen, onClose }) {
  const [categories, setCategories] = useState([])
  const [defaultCategory, setDefaultCategoryState] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  /**
   * 데이터 로드
   */
  const loadData = async () => {
    try {
      setLoading(true)
      const [cats, defaultCat] = await Promise.all([
        getCategories(),
        getDefaultCategory()
      ])
      setCategories(cats)
      setDefaultCategoryState(defaultCat)
    } catch (error) {
      console.error('데이터 로드 오류:', error)
      showToast('데이터를 불러오는 중 오류가 발생했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  /**
   * 기본 카테고리 설정
   */
  const handleSetDefault = async (categoryName) => {
    if (categoryName === defaultCategory) {
      return // 이미 기본 카테고리인 경우
    }

    try {
      setSaving(true)
      await setDefaultCategory(categoryName)
      setDefaultCategoryState(categoryName)
      
      // 카테고리 변경 이벤트 발생
      window.dispatchEvent(new Event('categoryChanged'))
      
      // 성공 메시지 대신 자동으로 닫기
      setTimeout(() => {
        onClose()
      }, 300)
    } catch (error) {
      console.error('기본 카테고리 설정 오류:', error)
      showToast(error.message || '기본 카테고리 설정에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="bg-pink-50 px-6 py-4 border-b-2 border-pink-200 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-handwriting text-gray-800 mb-1">
              카테고리 설정
            </h2>
            <p className="text-base text-gray-600 font-sans">
              기본 카테고리를 선택하세요. 기본 카테고리는 항상 맨 앞에 표시됩니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500 text-xl">로딩 중...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-lg">
              카테고리가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => {
                const isSystemCategory = category.name === SYSTEM_CATEGORY_DAILY
                const isDefault = category.name === defaultCategory
                const isDisabled = isSystemCategory || isDefault || saving
                
                return (
                  <div
                    key={category.name}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                      isDefault
                        ? 'border-pink-400 bg-pink-50'
                        : isSystemCategory
                        ? 'border-gray-300 bg-gray-50'
                        : 'border-gray-200 bg-white hover:border-pink-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{category.emoji}</span>
                      <span className="text-xl font-sans">{category.name}</span>
                      {isSystemCategory && (
                        <span className="px-3 py-1 bg-gray-400 text-white text-sm rounded-full font-sans">
                          시스템 카테고리
                        </span>
                      )}
                      {isDefault && !isSystemCategory && (
                        <span className="px-3 py-1 bg-pink-400 text-white text-sm rounded-full font-sans">
                          기본 카테고리
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleSetDefault(category.name)}
                      disabled={isDisabled}
                      className={`px-6 py-2 rounded-lg font-sans transition-colors ${
                        isDisabled
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-pink-400 text-white hover:bg-pink-500'
                      }`}
                    >
                      {isSystemCategory
                        ? '설정 불가'
                        : isDefault
                        ? '현재 기본'
                        : '기본으로 설정'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
