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
import { getRecipeCatalog } from '../services/recipeCatalogService.js'
import FridgeShelfView from './FridgeShelfView.jsx'
import FridgeMenuRecommendModal from './FridgeMenuRecommendModal.jsx'
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
 * 구역별 보관중 상품 리스트
 */
function ZoneItemList({
  zoneLabel,
  items,
  updatingQuantityId,
  updatingStatusId,
  onQuantityChange,
  onEdit,
  onComplete,
  onDiscard,
}) {
  return (
    <div className="mb-1 rounded-2xl border-2 border-green-100 bg-white p-3 shadow-sm min-h-[280px]">
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-sm font-sans font-semibold text-gray-700">{zoneLabel} 목록</p>
        <p className="text-xs font-sans text-gray-500">
          {items.length === 0 ? '비어 있음' : `${items.length}개`}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm font-sans text-gray-400">등록된 상품이 없습니다.</p>
      ) : (
        <ul className="space-y-2 max-h-[420px] overflow-y-auto">
          {items.map((item) => {
            const expiry = getExpiryStyle(item.expires_at)
            const statusBusy = updatingStatusId === item.id
            return (
              <li
                key={item.id}
                className="rounded-lg border border-green-100 bg-green-50/40 px-3 py-2.5"
              >
                <p className="font-sans font-semibold text-gray-800 truncate">{item.name}</p>
                <p className="mt-0.5 text-xs font-sans text-gray-500">
                  등록 {item.registered_at}
                  <span className="mx-1.5 text-gray-300">|</span>
                  기한 <span className={expiry.className}>{expiry.label}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <QuantityStepper
                    size="sm"
                    value={item.quantity ?? 1}
                    disabled={updatingQuantityId === item.id}
                    onChange={(next) => onQuantityChange(item, next)}
                  />
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="px-2.5 py-1 text-xs bg-white text-green-700 border border-green-200 rounded-md hover:bg-green-50 font-sans"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    disabled={statusBusy}
                    onClick={() => onComplete(item)}
                    className="px-2.5 py-1 text-xs bg-white text-blue-700 border border-blue-200 rounded-md hover:bg-blue-50 font-sans disabled:opacity-50"
                  >
                    완료
                  </button>
                  <button
                    type="button"
                    disabled={statusBusy}
                    onClick={() => onDiscard(item)}
                    className="px-2.5 py-1 text-xs bg-white text-orange-700 border border-orange-200 rounded-md hover:bg-orange-50 font-sans disabled:opacity-50"
                  >
                    폐기
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * 냉장고 관리 — 구역별 그림으로 보관중 재료를 표시
 */
export default function FridgeInventoryView() {
  const [activeStatus, setActiveStatus] = useState(FRIDGE_STATUSES.ACTIVE)
  const [archiveItems, setArchiveItems] = useState([])
  const [shelfItems, setShelfItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  const [updatingQuantityId, setUpdatingQuantityId] = useState(null)
  /** 목록 모드로 보는 구역 id 집합 */
  const [listViewZones, setListViewZones] = useState(() => new Set())
  const [showMenuRecommend, setShowMenuRecommend] = useState(false)
  const [catalog, setCatalog] = useState([])
  const [formData, setFormData] = useState({
    zone: FRIDGE_ZONES.FRIDGE,
    name: '',
    quantity: 1,
    registered_at: todayYmd(),
    expires_at: '',
  })

  const isActiveView = activeStatus === FRIDGE_STATUSES.ACTIVE

  const toggleZoneListView = (zoneId) => {
    setListViewZones((prev) => {
      const next = new Set(prev)
      if (next.has(zoneId)) next.delete(zoneId)
      else next.add(zoneId)
      return next
    })
  }

  useEffect(() => {
    loadData()
  }, [activeStatus])

  useEffect(() => {
    let cancelled = false
    getRecipeCatalog()
      .then((rows) => {
        if (!cancelled) setCatalog(rows || [])
      })
      .catch(() => {
        if (!cancelled) setCatalog([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      if (activeStatus === FRIDGE_STATUSES.ACTIVE) {
        const data = await getFridgeItems({ status: FRIDGE_STATUSES.ACTIVE })
        setShelfItems(data)
        setArchiveItems([])
      } else {
        const data = await getFridgeItems({ status: activeStatus })
        setArchiveItems(data)
      }
    } catch (error) {
      console.error('냉장고 목록 로드 실패:', error)
      showToast('상품 목록을 불러오지 못했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      zone: FRIDGE_ZONES.FRIDGE,
      name: '',
      quantity: 1,
      registered_at: todayYmd(),
      expires_at: '',
    })
    setEditingItem(null)
    setShowForm(false)
  }

  const openCreateForm = (zone = FRIDGE_ZONES.FRIDGE) => {
    setEditingItem(null)
    setFormData({
      zone,
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
      zone: item.zone || FRIDGE_ZONES.FRIDGE,
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
        zone: formData.zone,
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
      loadData()
    } catch (error) {
      console.error('냉장고 상품 저장 실패:', error)
      showToast('저장에 실패했습니다.', TOAST_TYPES.ERROR)
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
      if (editingItem?.id === item.id) resetForm()
      loadData()
    } catch (error) {
      console.error('상태 변경 실패:', error)
      showToast('상태 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const handleQuantityChange = async (item, nextQuantity) => {
    if (nextQuantity < 1 || updatingQuantityId) return

    const previousQuantity = item.quantity ?? 1
    const patch = (rows) =>
      rows.map((row) => (row.id === item.id ? { ...row, quantity: nextQuantity } : row))
    const revert = (rows) =>
      rows.map((row) => (row.id === item.id ? { ...row, quantity: previousQuantity } : row))

    setShelfItems(patch)
    setUpdatingQuantityId(item.id)

    try {
      await updateFridgeItem(item.id, { quantity: nextQuantity })
    } catch (error) {
      console.error('수량 변경 실패:', error)
      setShelfItems(revert)
      showToast('수량 변경에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setUpdatingQuantityId(null)
    }
  }

  const handleDelete = async () => {
    if (!editingItem) return
    if (!window.confirm(`「${editingItem.name}」을(를) 정말 삭제할까요?`)) return

    try {
      await deleteFridgeItem(editingItem.id)
      showToast('상품이 삭제되었습니다.', TOAST_TYPES.SUCCESS)
      resetForm()
      loadData()
    } catch (error) {
      console.error('냉장고 상품 삭제 실패:', error)
      showToast('삭제에 실패했습니다.', TOAST_TYPES.ERROR)
    }
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col px-4">
      <div className="mb-6">
        <h1 className="text-4xl font-handwriting text-gray-800 mb-2">냉장고 관리</h1>
        <p className="text-lg text-gray-600 font-sans">
          냉장실·냉동고·실온 그림을 탭해 재료를 관리하세요
        </p>
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
        {isActiveView && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowMenuRecommend(true)}
              disabled={loading || shelfItems.length === 0}
              className="px-5 py-2 bg-orange-400 text-white rounded-lg hover:bg-orange-500 transition-colors font-sans font-medium shadow-md disabled:opacity-50 disabled:hover:bg-orange-400"
            >
              메뉴 추천
            </button>
            <button
              type="button"
              onClick={() => openCreateForm()}
              className="px-5 py-2 bg-green-400 text-white rounded-lg hover:bg-green-500 transition-colors font-sans font-medium shadow-md"
            >
              + 상품 추가
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {loading ? (
          <p className="text-center text-gray-500 py-12 font-sans">불러오는 중...</p>
        ) : isActiveView ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FRIDGE_ZONE_TABS.map((tab) => {
              const zoneItems = shelfItems.filter((row) => row.zone === tab.id)
              const showList = listViewZones.has(tab.id)
              return (
                <div key={tab.id} className="min-w-0">
                  {showList ? (
                    <ZoneItemList
                      zoneLabel={tab.label}
                      items={zoneItems}
                      updatingQuantityId={updatingQuantityId}
                      updatingStatusId={updatingStatusId}
                      onQuantityChange={handleQuantityChange}
                      onEdit={handleEdit}
                      onComplete={(item) =>
                        handleStatusChange(item, FRIDGE_STATUSES.COMPLETED)
                      }
                      onDiscard={(item) =>
                        handleStatusChange(item, FRIDGE_STATUSES.DISCARDED)
                      }
                    />
                  ) : (
                    <FridgeShelfView
                      zone={tab.id}
                      items={zoneItems}
                      catalog={catalog}
                      onItemClick={handleEdit}
                    />
                  )}
                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleZoneListView(tab.id)}
                      className={`flex-1 py-2 text-sm font-sans rounded-lg transition-colors ${
                        showList
                          ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                          : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                      }`}
                    >
                      {showList ? '그림으로 보기' : '목록으로 보기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateForm(tab.id)}
                      className="flex-1 py-2 text-sm font-sans text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                    >
                      + 추가
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : archiveItems.length === 0 ? (
          <p className="text-center text-gray-500 py-12 font-sans">
            {getFridgeStatusLabel(activeStatus)} 상품이 없습니다.
          </p>
        ) : (
          <ul className="space-y-3">
            {archiveItems.map((item) => {
              const expiry = getExpiryStyle(item.expires_at)
              const statusBusy = updatingStatusId === item.id
              const zoneLabel =
                FRIDGE_ZONE_TABS.find((tab) => tab.id === item.zone)?.label || item.zone
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
                      {zoneLabel}
                      <span className="mx-2 text-gray-300">|</span>
                      등록일 {item.registered_at}
                      <span className="mx-2 text-gray-300">|</span>
                      유통기한{' '}
                      <span className={expiry.className}>{expiry.label}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className="text-sm text-gray-500 font-sans tabular-nums px-2">
                      수량 {item.quantity ?? 1}
                    </span>
                    <button
                      type="button"
                      disabled={statusBusy}
                      onClick={() => handleStatusChange(item, FRIDGE_STATUSES.ACTIVE)}
                      className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-sans disabled:opacity-50"
                    >
                      보관중으로
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {showMenuRecommend && (
        <FridgeMenuRecommendModal
          open={showMenuRecommend}
          ingredients={shelfItems}
          onClose={() => setShowMenuRecommend(false)}
        />
      )}

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
                  보관 구역 *
                </label>
                <div className="flex gap-2">
                  {FRIDGE_ZONE_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, zone: tab.id })}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-sans font-medium transition-colors ${
                        formData.zone === tab.id
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
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
                  <>
                    <button
                      type="button"
                      disabled={updatingStatusId === editingItem.id}
                      onClick={() => handleStatusChange(editingItem, FRIDGE_STATUSES.COMPLETED)}
                      className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-sans font-medium disabled:opacity-50"
                    >
                      완료
                    </button>
                    <button
                      type="button"
                      disabled={updatingStatusId === editingItem.id}
                      onClick={() => handleStatusChange(editingItem, FRIDGE_STATUSES.DISCARDED)}
                      className="px-4 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors font-sans font-medium disabled:opacity-50"
                    >
                      폐기
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="ml-auto px-6 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-sans font-medium"
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
