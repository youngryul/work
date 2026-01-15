import { useState, useEffect } from 'react'
import { getCategories } from '../services/categoryService.js'
import { SYSTEM_CATEGORY_DAILY } from '../constants/categories.js'

/**
 * 카테고리 선택 컴포넌트 (Select Box)
 * @param {Object} props
 * @param {string} props.selectedCategory - 현재 선택된 카테고리
 * @param {Function} props.onChange - 카테고리 변경 콜백
 */
export default function CategorySelector({ selectedCategory, onChange }) {
  const [categories, setCategories] = useState([])

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await getCategories()
        setCategories(cats)
        // 카테고리가 로드되었는데 selectedCategory가 없으면 첫 번째 카테고리 선택
        if (!selectedCategory && cats.length > 0 && onChange) {
          onChange(cats[0].name)
        }
      } catch (error) {
        console.error('카테고리 로드 오류:', error)
      }
    }

    loadCategories()

    // 카테고리 변경 이벤트 리스너
    const handleCategoryChange = () => {
      loadCategories()
    }

    window.addEventListener('categoryChanged', handleCategoryChange)
    return () => window.removeEventListener('categoryChanged', handleCategoryChange)
  }, [selectedCategory, onChange])

  return (
    <select
      value={selectedCategory || ''}
      onChange={(e) => {
        // 일상 카테고리는 변경 불가
        if (e.target.value === SYSTEM_CATEGORY_DAILY && selectedCategory !== SYSTEM_CATEGORY_DAILY) {
          return
        }
        onChange(e.target.value)
      }}
      className="px-4 py-3 text-2xl border-2 border-pink-200 rounded-lg focus:outline-none focus:border-pink-400 shadow-sm bg-white flex-shrink-0"
      style={{ minWidth: '180px' }}
    >
      {categories.length === 0 ? (
        <option>카테고리 없음</option>
      ) : (
        categories.map((category) => (
          <option 
            key={category.name} 
            value={category.name}
            disabled={category.name === SYSTEM_CATEGORY_DAILY && selectedCategory !== SYSTEM_CATEGORY_DAILY}
          >
            {category.emoji} {category.name}
          </option>
        ))
      )}
    </select>
  )
}
