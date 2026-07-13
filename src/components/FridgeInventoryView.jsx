import { useEffect, useState } from 'react'
import { format, differenceInCalendarDays, parseISO } from 'date-fns'
import {
  FRIDGE_ZONE_TABS,
  FRIDGE_ZONES,
  FRIDGE_STATUS_TABS,
  FRIDGE_STATUSES,
  getFridgeStatusLabel,
} from '../constants/fridgeInventory.js'
import {
  getFridgeItems,
  createFridgeItem,
  updateFridgeItem,
  updateFridgeItemStatus,
  deleteFridgeItem,
} from '../services/fridgeInventoryService.js'
import { showToast, TOAST_TYPES } from './Toast.jsx'

function todayYmd() {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * 수량 − / + 스테퍼
 */
function QuantityStepper({ value, onChange, min = 1, size = 'md', disabled = false }) {
  const current = Math.max(min, Number(value) || min)
  const buttonSize =
    size === 'sm' ? 'w-8 h-8 text-lg' : 'w-10 h-10 text-xl'
  const valueSize = size === 'sm' ? 'w-10 text-base' : 'w-12 text-lg'

  return (
    <div className="inline-flex items-center gap-1 select-none">
      <button
        type="button"
        disabled={disabled || current <= min}
        onClick={() => onChange(current - 1)}
        className={`${buttonSize} rounded-lg border-2 border-green-200 bg-white text-gray-700 font-sans font-semibold hover:bg-green-50 disabled:opacity-40 disabled:hover:bg-white transition-colors`}
        aria-label="수량 줄이기"
      >
        −
      </button>
      <span
        className={`${valueSize} text-center font-sans font-semibold text-gray-800 tabular-nums`}
        aria-live="polite"
      >
        {current}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(current + 1)}
        className={`${buttonSize} rounded-lg border-2 border-green-200 bg-white text-gray-700 font-sans font-semibold hover:bg-green-50 disabled:opacity-40 disabled:hover:bg-white transition-colors`}
        aria-label="수량 늘리기"
      >
        +
      </button>
    </div>
  )
}

/**
 * 유통기한 상태에 따른 표시 클래스
 * @param {string|null} expiresAt
 * @returns {{ label: string, className: string }}
 */
function getExpiryStyle(expiresAt) {
  if (!expiresAt) {
    return { label: '기한 없음', className: 'text-gray-500' }
  }

  const daysLeft = differenceInCalendarDays(parseISO(expiresAt), new Date())
  if (daysLeft < 0) {
    return { label: `${expiresAt} (지남)`, className: 'text-red-600 font-semibold' }
  }
  if (daysLeft <= 3) {
    return { label: `${expiresAt} (임박)`, className: 'text-orange-600 font-semibold' }
  }
  return { label: expiresAt, className: 'text-gray-700' }
}

/**
 * 냉장고 관리 — 냉장실 / 냉동고 / 실온 구역별 상품 관리
 */
export default function FridgeInventoryView() {
  const [activeZone, setActiveZone] = useState(FRIDGE_ZONES.FRIDGE)
  const [activeStatus, setActiveStatus] = useState(FRIDGE_STATUSES.ACTIVE)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [updatingQuantityId, setUpdatingQuantityId] = useState(null)
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    quantity: 1,
    registered_at: todayYmd(),
    expires_at: '',
  })

  useEffect(() => {
    loadItems()
  }, [activeZone, activeStatus])

  const loadItems = async () => {
    try {
      setLoading(true)
      const data = await getFridgeItems({ zone: activeZone, status: activeStatus })
      setItems(data)
    } catch (error) {
      console.error('냉장고 목록 로드 실패:', error)
      showToast('상품 목록을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      quantity: 1,
      registered_at: todayYmd(),
      expires_at: '',
    })
    setEditingItem(null)
    setShowForm(false)
  }

  const openCreateForm = () => {
    setEditingItem(null)
    setFormData({
      name: '',
      quantity: 1,
      registered_at: todayYmd(),
      expires_at: '',
    })
    setShowForm(true)
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      quantity: item.quantity ?? 1,
      registered_at: item.registered_at,
      expires_at: item.expires_at || '',
    })
    setShowForm(true)
  }

  const handleSave = async (event) => {
    event.preventDefault()

    if (!formData.name.trim()) {
      showToast('상품명을 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }
    if (!formData.registered_at) {
      showToast('등록 날짜를 선택해주세요.', TOAST_TYPES.ERROR)
      return
    }
    const quantity = Number(formData.quantity)
    if (!Number.isFinite(quantity) || quantity < 1) {
      showToast('수량은 1 이상으로 입력해주세요.', TOAST_TYPES.ERROR)
      return
    }

    try {
      const payload = {
        zone: activeZone,
        name: formData.name.trim(),
        quantity: Math.floor(quantity),
        registered_at: formData.registered_at,
        expires_at: formData.expires_at || null,
      }

      if (editingItem) {
        await updateFridgeItem(editingItem.id, payload)
        showToast('상품이 수정되었습니다.', TOAST_TYPES.SUCCESS)
      } else {
        await createFridgeItem({
          ...payload,
          status: FRIDGE_STATUSES.ACTIVE,
        })
        showToast('상품이 등록되었습니다.', TOAST_TYPES.SUCCESS)
        if (activeStatus !== FRIDGE_STATUSES.ACTIVE) {
          setActiveStatus(FRIDGE_STATUSES.ACTIVE)
        }
      }

      resetForm()
      loadItems()
    } catch (error) {
      console.error('냉장고 상품 저장 실패:', error)
      showToast('저장에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const handleQuantityChange = async (item, nextQuantity) => {
    if (nextQuantity < 1 || updatingQuantityId) return

    const previousQuantity = item.quantity ?? 1
    setItems((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, quantity: nextQuantity } : row)),
    )
    setUpdatingQuantityId(item.id)

    try {
      await updateFridgeItem(item.id, { quantity: nextQuantity })
    } catch (error) {
      console.error('수량 변경 실패:', error)
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, quantity: previousQuantity } : row)),
      )
      showToast('수량 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setUpdatingQuantityId(null)
    }
  }

  const handleStatusChange = async (item, nextStatus) => {
    if (updatingStatusId) return

    const label = getFridgeStatusLabel(nextStatus)
    if (!window.confirm(`「${item.name}」을(를) ${label}(으)로 변경할까요?`)) return

    setUpdatingStatusId(item.id)
    try {
      await updateFridgeItemStatus(item.id, nextStatus)
      showToast(`${label} 상태로 변경되었습니다.`, TOAST_TYPES.SUCCESS)
      loadItems()
    } catch (error) {
      console.error('상태 변경 실패:', error)
      showToast('상태 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const handleDelete = async () => {
    if (!editingItem) return
    if (!window.confirm(`「${editingItem.name}」을(를) 정말 삭제할까요?`)) return

    try {
      await deleteFridgeItem(editingItem.id)
      showToast('상품이 삭제되었습니다.', TOAST_TYPES.SUCCESS)
      resetForm()
      loadItems()
    } catch (error) {
      console.error('냉장고 상품 삭제 실패:', error)
      showToast('삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  const isActiveList = activeStatus === FRIDGE_STATUSES.ACTIVE

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col px-4">
      <div className="mb-6">
        <h1 className="text-4xl font-handwriting text-gray-800 mb-2">냉장고 관리</h1>
        <p className="text-lg text-gray-600 font-sans">
          냉장실·냉동고·실온 상품의 등록일과 유통기한을 관리하세요
        </p>
      </div>

      <div className="flex gap-2 mb-4 border-b-2 border-gray-200">
        {FRIDGE_ZONE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveZone(tab.id)}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeZone === tab.id
                ? 'border-b-2 border-green-500 text-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {FRIDGE_STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveStatus(tab.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-sans font-medium transition-colors ${
                activeStatus === tab.id
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {isActiveList && (
          <button
            type="button"
            onClick={openCreateForm}
            className="px-5 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors font-sans font-medium shadow-md"
          >
            + 상품 추가
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-center text-gray-500 py-12 font-sans">불러오는 중...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-500 py-12 font-sans">
            {isActiveList ? '등록된 상품이 없습니다.' : `${getFridgeStatusLabel(activeStatus)} 상품이 없습니다.`}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const expiry = getExpiryStyle(item.expires_at)
              const statusBusy = updatingStatusId === item.id
              return (
                <li
                  key={item.id}
                  className="bg-white border-2 border-green-100 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-gray-800 font-sans truncate">
                      {item.name}
                    </p>
                    <p className="text-sm text-gray-500 font-sans mt-1">
                      등록일 {item.registered_at}
                      <span className="mx-2 text-gray-300">|</span>
                      유통기한{' '}
                      <span className={expiry.className}>{expiry.label}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isActiveList && (
                      <QuantityStepper
                        size="sm"
                        value={item.quantity ?? 1}
                        disabled={updatingQuantityId === item.id}
                        onChange={(next) => handleQuantityChange(item, next)}
                      />
                    )}
                    {!isActiveList && (
                      <span className="text-sm text-gray-500 font-sans tabular-nums px-2">
                        수량 {item.quantity ?? 1}
                      </span>
                    )}
                    {isActiveList && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-sans"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          disabled={statusBusy}
                          onClick={() => handleStatusChange(item, FRIDGE_STATUSES.COMPLETED)}
                          className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-sans disabled:opacity-50"
                        >
                          완료
                        </button>
                        <button
                          type="button"
                          disabled={statusBusy}
                          onClick={() => handleStatusChange(item, FRIDGE_STATUSES.DISCARDED)}
                          className="px-3 py-1.5 text-sm bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 font-sans disabled:opacity-50"
                        >
                          폐기
                        </button>
                      </>
                    )}
                    {!isActiveList && (
                      <button
                        type="button"
                        disabled={statusBusy}
                        onClick={() => handleStatusChange(item, FRIDGE_STATUSES.ACTIVE)}
                        className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-sans disabled:opacity-50"
                      >
                        보관중으로
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={resetForm}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-green-50 px-6 py-4 border-b-2 border-green-200 flex items-center justify-between">
              <h2 className="text-2xl font-handwriting text-gray-800">
                {editingItem ? '상품 수정' : '상품 추가'}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                  상품명 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans"
                  placeholder="예: 우유"
                  required
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                  수량 *
                </label>
                <QuantityStepper
                  value={formData.quantity}
                  onChange={(next) => setFormData({ ...formData, quantity: next })}
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                  등록 날짜 *
                </label>
                <input
                  type="date"
                  value={formData.registered_at}
                  onChange={(e) => setFormData({ ...formData, registered_at: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans"
                  required
                />
              </div>
              <div>
                <label className="block text-base font-medium text-gray-700 mb-2 font-sans">
                  유통기한
                </label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-base bg-white font-sans"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors font-sans font-medium shadow-md"
                >
                  {editingItem ? '수정' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-sans font-medium"
                >
                  취소
                </button>
                {editingItem && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="ml-auto px-6 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-sans font-medium"
                  >
                    삭제
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
