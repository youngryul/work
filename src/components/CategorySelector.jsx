import { useState, useEffect } from 'react'
import { getCategories } from '../services/categoryService.js'

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
      const cats = await getCategories()
      setCategories(cats)
    }

    loadCategories()

    // 카테고리 변경 이벤트 리스너
    const handleCategoryChange = () => {
      loadCategories()
    }

    window.addEventListener('categoryChanged', handleCategoryChange)
    return () => window.removeEventListener('categoryChanged', handleCategoryChange)
  }, [])

  return (
    <select
      value={selectedCategory}
      onChange={(e) => onChange(e.target.value)}
      className="px-4 py-3 text-2xl border-2 border-pink-200 rounded-lg focus:outline-none focus:border-pink-400 shadow-sm bg-white flex-shrink-0"
      style={{ minWidth: '180px' }}
    >
      {categories.map((category) => (
        <option key={category.name} value={category.name}>
          {category.emoji} {category.name}
        </option>
      ))}
    </select>
  )
}
