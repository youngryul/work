import { FRIDGE_ZONES } from '../constants/fridgeInventory.js'
import {
  findCatalogMatchForFridgeItem,
  resolveFridgeItemIcon,
} from '../constants/fridgeItemIcons.js'

/** 냉장고 내부 사진 기준 선반·서랍 슬롯 (% — top 기준, 아이템이 앉는 영역) */
const SHELF_SLOTS = [
  { id: 'shelf-1', top: '12%', height: '17%' },
  { id: 'shelf-2', top: '31%', height: '17%' },
  { id: 'shelf-3', top: '50%', height: '17%' },
  { id: 'drawers', top: '70%', height: '24%', split: true },
]

const FRIDGE_IMAGE_SRC = '/images/fridge-interior.png'

/**
 * @param {string} zone
 */
function zoneMeta(zone) {
  if (zone === FRIDGE_ZONES.FREEZER) {
    return {
      label: '냉동고',
      tint: 'bg-sky-300/25',
      ring: 'ring-sky-300',
    }
  }
  if (zone === FRIDGE_ZONES.PANTRY) {
    return {
      label: '실온',
      tint: 'bg-amber-300/25',
      ring: 'ring-amber-300',
    }
  }
  return {
    label: '냉장실',
    tint: 'bg-emerald-300/15',
    ring: 'ring-emerald-300',
  }
}

/**
 * 아이템을 선반 슬롯으로 분배 (마지막 슬롯은 좌·우 서랍)
 * @param {Array} items
 * @returns {{ shelves: Array[], leftDrawer: Array, rightDrawer: Array }}
 */
function distributeItems(items) {
  const shelfCount = SHELF_SLOTS.length - 1
  const shelves = Array.from({ length: shelfCount }, () => [])
  const leftDrawer = []
  const rightDrawer = []

  items.forEach((item, index) => {
    const slot = index % SHELF_SLOTS.length
    if (slot < shelfCount) {
      shelves[slot].push(item)
      return
    }
    if (leftDrawer.length <= rightDrawer.length) {
      leftDrawer.push(item)
    } else {
      rightDrawer.push(item)
    }
  })

  return { shelves, leftDrawer, rightDrawer }
}

/**
 * @param {{
 *   item: object,
 *   catalog?: Array,
 *   onItemClick?: (item: object) => void,
 *   compact?: boolean,
 * }} props
 */
function FridgeItemSticker({ item, catalog = [], onItemClick, compact = false }) {
  const match = findCatalogMatchForFridgeItem(item.name, catalog)
  const icon = resolveFridgeItemIcon(item.name, match)
  const qty = item.quantity ?? 1

  return (
    <button
      type="button"
      onClick={() => onItemClick?.(item)}
      title={`${item.name} × ${qty}`}
      className={`group relative flex flex-col items-center rounded-lg border border-white/90 bg-white/92 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg ${
        compact ? 'w-11 px-0.5 py-0.5' : 'w-14 px-1 py-1'
      }`}
    >
      {icon.imageUrl ? (
        <img
          src={icon.imageUrl}
          alt=""
          className={`rounded object-cover ${compact ? 'h-6 w-6' : 'h-7 w-7'}`}
        />
      ) : (
        <span className={`leading-none ${compact ? 'text-xl' : 'text-2xl'}`} aria-hidden>
          {icon.emoji}
        </span>
      )}
      <span
        className={`mt-0.5 w-full truncate text-center font-sans font-medium text-gray-700 ${
          compact ? 'text-[8px]' : 'text-[9px]'
        }`}
      >
        {item.name}
      </span>
      {qty > 1 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-green-500 px-0.5 text-[9px] font-bold text-white shadow">
          {qty}
        </span>
      )}
    </button>
  )
}

/**
 * 실제 냉장고 사진 위에 재료 스티커를 올리는 선반 뷰
 * @param {{
 *   zone: string,
 *   items: Array,
 *   catalog?: Array,
 *   onItemClick?: (item: object) => void,
 * }} props
 */
export default function FridgeShelfView({
  zone,
  items = [],
  catalog = [],
  onItemClick,
}) {
  const meta = zoneMeta(zone)
  const { shelves, leftDrawer, rightDrawer } = distributeItems(items)

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-sm font-sans font-semibold text-gray-700">
          {meta.label} 미리보기
        </p>
        <p className="text-xs font-sans text-gray-500">
          {items.length === 0 ? '비어 있음' : `${items.length}개 · 탭하여 수정`}
        </p>
      </div>

      <div
        className={`relative mx-auto w-full max-w-md overflow-hidden rounded-2xl shadow-lg ring-4 ${meta.ring}`}
        style={{ aspectRatio: '525 / 900' }}
      >
        <img
          src={FRIDGE_IMAGE_SRC}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        {/* 구역 구분용 은은한 틴트 */}
        <div className={`pointer-events-none absolute inset-0 ${meta.tint}`} />

        {SHELF_SLOTS.slice(0, 3).map((slot, index) => (
          <div
            key={slot.id}
            className="absolute left-[8%] right-[8%] flex items-end justify-center gap-1.5 overflow-hidden px-1"
            style={{ top: slot.top, height: slot.height }}
          >
            {shelves[index].map((item) => (
              <FridgeItemSticker
                key={item.id}
                item={item}
                catalog={catalog}
                onItemClick={onItemClick}
              />
            ))}
          </div>
        ))}

        {/* 하단 서랍 좌·우 */}
        <div
          className="absolute left-[8%] right-[8%] flex gap-2"
          style={{ top: SHELF_SLOTS[3].top, height: SHELF_SLOTS[3].height }}
        >
          <div className="flex flex-1 items-center justify-center gap-1 overflow-hidden px-1">
            {leftDrawer.map((item) => (
              <FridgeItemSticker
                key={item.id}
                item={item}
                catalog={catalog}
                onItemClick={onItemClick}
                compact
              />
            ))}
          </div>
          <div className="flex flex-1 items-center justify-center gap-1 overflow-hidden px-1">
            {rightDrawer.map((item) => (
              <FridgeItemSticker
                key={item.id}
                item={item}
                catalog={catalog}
                onItemClick={onItemClick}
                compact
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
