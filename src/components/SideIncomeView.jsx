import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import {
  getSideIncomesByYear,
  saveSideIncome,
  updateSideIncome,
  deleteSideIncome,
} from '../services/sideIncomeService.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

const createEmptyForm = () => ({
  income_date: format(new Date(), 'yyyy-MM-dd'),
  title: '',
  amount: '',
})

/**
 * 부수입(월급 이외 수입) 관리 뷰
 * 연도별 월 합계를 보여주고, 월을 선택하면 해당 월 내역만 표시
 */
export default function SideIncomeView() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  // null이면 연간 전체 내역
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [incomes, setIncomes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingIncome, setEditingIncome] = useState(null)
  const [formData, setFormData] = useState(createEmptyForm)

  useEffect(() => {
    loadIncomes()
  }, [year])

  const loadIncomes = async () => {
    try {
      setLoading(true)
      setIncomes(await getSideIncomesByYear(year))
    } catch (error) {
      console.error('부수입 로드 실패:', error)
      showToast('부수입 내역을 불러오는데 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  /** 1~12월 합계 */
  const monthlyTotals = useMemo(() => {
    const totals = Array(12).fill(0)
    incomes.forEach((income) => {
      const month = Number(income.income_date.slice(5, 7))
      totals[month - 1] += Number(income.amount)
    })
    return totals
  }, [incomes])

  const yearTotal = monthlyTotals.reduce((sum, value) => sum + value, 0)
  const maxMonthTotal = Math.max(...monthlyTotals, 1)

  const visibleIncomes = selectedMonth
    ? incomes.filter((income) => Number(income.income_date.slice(5, 7)) === selectedMonth)
    : incomes
  const visibleTotal = visibleIncomes.reduce((sum, income) => sum + Number(income.amount), 0)

  const resetForm = () => {
    setFormData(createEmptyForm())
    setEditingIncome(null)
    setShowForm(false)
  }

  const openCreateForm = () => {
    const form = createEmptyForm()
    // 다른 달을 보고 있으면 그 달 1일로 기본값 지정
    const now = new Date()
    if (selectedMonth && (year !== now.getFullYear() || selectedMonth !== now.getMonth() + 1)) {
      form.income_date = `${year}-${String(selectedMonth).padStart(2, '0')}-01`
    }
    setEditingIncome(null)
    setFormData(form)
    setShowForm(true)
  }

  const handleEdit = (income) => {
    setEditingIncome(income)
    setFormData({
      income_date: income.income_date,
      title: income.title,
      amount: String(income.amount),
    })
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      showToast('내역을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      showToast('금액을 올바르게 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    const payload = {
      income_date: formData.income_date,
      title: formData.title.trim(),
      amount: Number(formData.amount),
    }

    try {
      if (editingIncome) {
        await updateSideIncome(editingIncome.id, payload)
        showToast('수정되었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await saveSideIncome(payload)
        showToast('저장되었습니다.', TOAST_TYPES.SUCCESS)
      }
      resetForm()
      // 다른 연도로 저장했다면 그 연도/월로 이동
      const savedYear = Number(payload.income_date.slice(0, 4))
      setSelectedMonth(Number(payload.income_date.slice(5, 7)))
      if (savedYear !== year) {
        setYear(savedYear)
      } else {
        loadIncomes()
      }
    } catch (error) {
      console.error('부수입 저장 실패:', error)
      showToast('저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return

    try {
      await deleteSideIncome(id)
      showToast('삭제되었습니다.', TOAST_TYPES.SUCCESS)
      loadIncomes()
    } catch (error) {
      console.error('부수입 삭제 실패:', error)
      showToast('삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const inputClassName =
    'w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans'

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-4xl font-handwriting text-gray-800 mb-2">부수입</h1>
        <p className="text-lg text-gray-600 font-sans">월급 이외의 수입을 기록하고 월별 합계를 확인하세요</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pb-6">
        {/* 연도 선택 + 연간 합계 */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="w-9 h-9 rounded-lg bg-white border-2 border-gray-200 hover:border-green-300 text-gray-600 font-sans"
              aria-label="이전 연도"
            >
              ‹
            </button>
            <span className="text-2xl font-sans font-bold text-gray-800 w-24 text-center">{year}년</span>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="w-9 h-9 rounded-lg bg-white border-2 border-gray-200 hover:border-green-300 text-gray-600 font-sans"
              aria-label="다음 연도"
            >
              ›
            </button>
          </div>
          <div className="text-right font-sans">
            <div className="text-sm text-gray-500">{year}년 총 부수입</div>
            <div className="text-2xl font-bold text-green-600">{yearTotal.toLocaleString()}원</div>
          </div>
        </div>

        {/* 월별 합계 */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {monthlyTotals.map((total, index) => {
            const month = index + 1
            const isSelected = selectedMonth === month
            return (
              <button
                key={month}
                onClick={() => setSelectedMonth(isSelected ? null : month)}
                className={`p-3 rounded-lg border-2 text-left transition-colors font-sans ${
                  isSelected
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-200 bg-white/80 hover:border-green-300'
                }`}
              >
                <div className="text-sm text-gray-500">{month}월</div>
                <div className={`text-base font-bold truncate ${total > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                  {total.toLocaleString()}원
                </div>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-400 rounded-full"
                    style={{ width: `${(total / maxMonthTotal) * 100}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>

        {/* 내역 헤더 */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="font-sans">
            <span className="text-xl font-bold text-gray-800">
              {selectedMonth ? `${selectedMonth}월 내역` : `${year}년 전체 내역`}
            </span>
            <span className="ml-3 text-base text-gray-600">
              총 {visibleIncomes.length}건 | 합계 {visibleTotal.toLocaleString()}원
            </span>
            {selectedMonth && (
              <button
                onClick={() => setSelectedMonth(null)}
                className="ml-3 text-sm text-green-600 hover:underline"
              >
                전체 보기
              </button>
            )}
          </div>
          <button
            onClick={openCreateForm}
            className="px-4 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors text-sm font-medium shadow-md font-sans"
          >
            + 수입 추가
          </button>
        </div>

        {/* 내역 목록 */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 font-sans">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
            <p>로딩 중...</p>
          </div>
        ) : visibleIncomes.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <p className="text-base text-gray-500 mb-2 font-sans">등록된 부수입이 없습니다.</p>
            <p className="text-sm text-gray-400 font-sans">새 수입을 추가해보세요.</p>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-sm rounded-lg border-2 border-gray-200 divide-y divide-gray-100">
            {visibleIncomes.map((income) => (
              <div key={income.id} className="flex items-center gap-4 px-4 py-3 font-sans">
                <div className="text-sm text-gray-500 w-14 shrink-0">
                  {Number(income.income_date.slice(5, 7))}/{Number(income.income_date.slice(8, 10))}
                </div>
                <div className="flex-1 min-w-0 text-base text-gray-800 truncate">{income.title}</div>
                <div className="text-base font-bold text-green-600 shrink-0">
                  +{Number(income.amount).toLocaleString()}원
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleEdit(income)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(income.id)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 추가/수정 모달 */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={resetForm}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-green-50 px-6 py-4 border-b-2 border-green-200 flex items-center justify-between">
              <h2 className="text-2xl font-handwriting text-gray-800">
                {editingIncome ? '부수입 수정' : '부수입 추가'}
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">날짜 *</label>
                <input
                  type="date"
                  value={formData.income_date}
                  onChange={(e) => setFormData({ ...formData, income_date: e.target.value })}
                  className={inputClassName}
                  required
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">내역 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={inputClassName}
                  placeholder="예: 블로그 광고 수익, 중고거래"
                  required
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">금액 *</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className={inputClassName}
                  placeholder="예: 50000"
                  min="1"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors font-sans font-medium shadow-md"
                >
                  {editingIncome ? '수정' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-sans font-medium"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
