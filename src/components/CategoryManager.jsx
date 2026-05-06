import { useState, useEffect } from 'react'
import { getCategories, addCategory, deleteCategory, getDefaultCategory } from '../services/categoryService.js'
import { SYSTEM_CATEGORY_DAILY, SYSTEM_CATEGORY_DAILY_EMOJI } from '../constants/categories.js'
import CategorySettingsModal from './CategorySettingsModal.jsx'
import { showToast, TOAST_TYPES } from './Toast.jsx'

/**
 * 카테고리 관리 컴포넌트
 * @param {Function} onCategoryChange - 카테고리 변경 콜백
 * @param {Function} onCategorySelect - 카테고리 선택 콜백
 */
export default function CategoryManager({ onCategoryChange, onCategorySelect }) {
  const [categories, setCategories] = useState([])
  const [defaultCategory, setDefaultCategory] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('')
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  useEffect(() => {
    loadCategories()
    loadDefaultCategory()
  }, [])

  /**
   * 카테고리 목록 로드
   */
  const loadCategories = async () => {
    const cats = await getCategories()
    setCategories(cats)
  }

  /**
   * 기본 카테고리 로드
   */
  const loadDefaultCategory = async () => {
    const defaultCat = await getDefaultCategory()
    setDefaultCategory(defaultCat)
  }

  /**
   * 카테고리 추가
   */
  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (newCategoryName.trim() === '' || newCategoryEmoji.trim() === '') {
      showToast('카테고리 이름과 이모지를 모두 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      await addCategory(newCategoryName, newCategoryEmoji)
      await loadCategories()
      await loadDefaultCategory()
      setNewCategoryName('')
      setNewCategoryEmoji('')
      setIsAdding(false)
      // 카테고리 변경 이벤트 발생
      window.dispatchEvent(new Event('categoryChanged'))
      if (onCategoryChange) {
        onCategoryChange()
      }
    } catch (error) {
      showToast(error.message || '카테고리 추가에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  /**
   * 카테고리 삭제
   */
  const handleDeleteCategory = async (categoryName) => {
    // 시스템 카테고리(일상)는 삭제 불가
    if (categoryName === SYSTEM_CATEGORY_DAILY) {
      showToast('일상 카테고리는 삭제할 수 없습니다.', TOAST_TYPES.ERROR)
      return
    }

    // 기본 카테고리는 삭제 불가
    if (categoryName === defaultCategory) {
      showToast('기본 카테고리는 삭제할 수 없습니다. 다른 카테고리를 기본으로 설정한 후 삭제해주세요.', TOAST_TYPES.ERROR)
      return
    }

    if (window.confirm(`"${categoryName}" 카테고리를 삭제하시겠어요?`)) {
      try {
        await deleteCategory(categoryName)
        await loadCategories()
        await loadDefaultCategory()
        // 카테고리 변경 이벤트 발생
        window.dispatchEvent(new Event('categoryChanged'))
        if (onCategoryChange) {
          onCategoryChange()
        }
      } catch (error) {
        showToast(error.message || '카테고리 삭제에 실패했습니다.', TOAST_TYPES.ERROR)
      }
    }
  }

  return (
    <div className="mb-4 p-4 bg-white rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-2xl font-handwriting text-gray-800">카테고리 관리</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-2 text-xl bg-blue-200 text-blue-700 rounded-lg hover:bg-blue-300 transition-colors duration-200 font-sans"
            title="기본 카테고리 설정"
          >
            ⚙️ 기본 설정
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2 text-xl bg-green-200 text-green-700 rounded-lg hover:bg-green-300 transition-colors duration-200"
          >
            {isAdding ? '취소' : '+ 추가'}
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={handleAddCategory} className="mb-4 p-3 bg-green-50 rounded-lg">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newCategoryEmoji}
              onChange={(e) => setNewCategoryEmoji(e.target.value)}
              placeholder="이모지 (예: 🎨)"
              className="w-20 px-3 py-2 text-2xl border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400 text-center"
              maxLength={2}
            />
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="카테고리 이름"
              className="flex-1 px-3 py-2 text-2xl border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xl bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors duration-200"
            >
              추가
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <div
            key={category.name}
            className="flex items-center gap-2 px-3 py-2 bg-green-100 rounded-lg cursor-pointer hover:bg-green-200 transition-colors duration-200"
            onClick={() => {
              if (onCategorySelect) {
                onCategorySelect(category.name)
              }
            }}
          >
            <span className="text-2xl">{category.emoji}</span>
            <span className="text-xl">{category.name}</span>
            {category.name === SYSTEM_CATEGORY_DAILY ? (
              <span className="ml-2 text-xs text-gray-500">(시스템)</span>
            ) : category.name === defaultCategory ? (
              <span className="ml-2 text-xs text-gray-500">(기본)</span>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteCategory(category.name)
                }}
                className="ml-2 text-red-500 hover:text-red-700 text-xl"
                aria-label="삭제"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 카테고리 설정 모달 */}
      <CategorySettingsModal
        isOpen={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false)
          // 모달이 닫힐 때 카테고리 목록 새로고침
          loadCategories()
          loadDefaultCategory()
        }}
      />
    </div>
  )
}

