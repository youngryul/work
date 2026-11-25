import { useCallback, useEffect, useMemo, useState } from 'react'
import { DECOR_SLOT_OPTIONS, EMPTY_POSILI_LOADOUT } from '../../constants/posiliDecor.js'
import { getGachaGradeMeta } from '../../constants/gachaGrades.js'
import {
  equipDecorItem,
  getMyDecorState,
  purchaseDecorItem,
} from '../../services/posiliDecorService.js'
import { useJellyBalance } from '../../hooks/useJellyBalance.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import PosiliAvatar from './PosiliAvatar.jsx'

/**
 * 포실이 꾸미기 — 입어보기 · 젤리 구매 · 착용
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.characterImageUrl 지금 보여줄 포실이 이미지
 */
export default function PosiliDecorModal({ open, onClose, characterImageUrl }) {
  const { balance } = useJellyBalance()
  const [items, setItems] = useState([])
  const [loadout, setLoadout] = useState(EMPTY_POSILI_LOADOUT)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeSlot, setActiveSlot] = useState(DECOR_SLOT_OPTIONS[0].id)
  // 입어보는 중인 아이템 — itemId가 null이면 "기본(없음)"
  const [selected, setSelected] = useState(null)
  const [isBusy, setIsBusy] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const state = await getMyDecorState()
      setItems(state.items)
      setLoadout(state.loadout)
    } catch (error) {
      console.error('꾸미기 정보 조회 실패:', error)
      setLoadError('꾸미기 정보를 불러오지 못했어요.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setSelected(null)
    load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isBusy) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, isBusy, onClose])

  const slotItems = useMemo(
    () => items.filter((item) => item.slot === activeSlot),
    [items, activeSlot],
  )

  const selectedItem = selected?.itemId ? items.find((item) => item.id === selected.itemId) : null

  const previewOverride = useMemo(() => {
    if (!selected) return {}
    return { [selected.slot]: selectedItem?.imageUrl ?? null }
  }, [selected, selectedItem])

  if (!open) return null

  const equippedId = loadout[activeSlot]?.itemId ?? null
  const activeSlotMeta = DECOR_SLOT_OPTIONS.find((slot) => slot.id === activeSlot)

  const handleEquip = async (slot, itemId, successMessage) => {
    setIsBusy(true)
    try {
      const next = await equipDecorItem(slot, itemId)
      setLoadout(next)
      setSelected(null)
      showToast(successMessage, TOAST_TYPES.SUCCESS)
    } catch (error) {
      showToast(error?.message || '착용에 실패했어요.', TOAST_TYPES.ERROR)
    } finally {
      setIsBusy(false)
    }
  }

  const handlePurchase = async (item) => {
    setIsBusy(true)
    try {
      await purchaseDecorItem(item.id)
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, owned: true } : row)))
    } catch (error) {
      showToast(error?.message || '구매에 실패했어요.', TOAST_TYPES.ERROR)
      setIsBusy(false)
      return
    }

    // 구매는 끝났으니 착용에 실패해도 보유 상태는 유지된다
    try {
      const next = await equipDecorItem(item.slot, item.id)
      setLoadout(next)
      setSelected(null)
      showToast(`${item.name}을(를) 구매하고 착용했어요!`, TOAST_TYPES.SUCCESS)
    } catch {
      showToast('구매는 완료됐어요. 착용은 다시 눌러 주세요.', TOAST_TYPES.INFO)
    } finally {
      setIsBusy(false)
    }
  }

  /** 하단 버튼 — 선택 상태에 따라 하나만 보여준다 */
  const renderAction = () => {
    if (!selected || selected.slot !== activeSlot) {
      return (
        <p className="text-center text-sm text-gray-500">아이템을 누르면 위에서 미리 입어볼 수 있어요.</p>
      )
    }

    const buttonBase =
      'w-full py-3 rounded-xl font-bold shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

    if (!selectedItem) {
      return (
        <button
          type="button"
          disabled={isBusy || !equippedId}
          onClick={() => handleEquip(activeSlot, null, '기본 모습으로 되돌렸어요.')}
          className={`${buttonBase} bg-gray-700 text-white hover:bg-gray-800`}
        >
          {equippedId ? '기본으로 되돌리기' : '지금 기본 모습이에요'}
        </button>
      )
    }

    if (selectedItem.owned) {
      const isEquipped = equippedId === selectedItem.id
      return (
        <button
          type="button"
          disabled={isBusy}
          onClick={() =>
            isEquipped
              ? handleEquip(activeSlot, null, '착용을 해제했어요.')
              : handleEquip(activeSlot, selectedItem.id, `${selectedItem.name}을(를) 착용했어요!`)
          }
          className={`${buttonBase} ${
            isEquipped ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {isEquipped ? '착용 해제' : '착용하기'}
        </button>
      )
    }

    const price = selectedItem.priceJelly
    const lacking = price > 0 && balance !== null && balance < price
    return (
      <button
        type="button"
        disabled={isBusy || lacking}
        onClick={() => handlePurchase(selectedItem)}
        className={`${buttonBase} bg-pink-500 text-white hover:bg-pink-600`}
      >
        {lacking
          ? `젤리가 부족해요 (${price}개 필요)`
          : price > 0
            ? `🍮 ${price}젤리로 구매하고 착용`
            : '무료로 받고 착용'}
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={() => !isBusy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="포실이 꾸미기"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border-2 border-pink-200 bg-white shadow-2xl font-sans"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-pink-100 to-amber-100 px-5 py-4">
          <h2 className="text-xl font-bold text-pink-900">🎀 포실이 꾸미기</h2>
          <div className="flex items-center gap-2">
            {balance !== null && (
              <span className="rounded-lg border border-pink-200 bg-white/80 px-2.5 py-1 text-sm font-bold text-pink-900 tabular-nums">
                🍮 {balance}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              aria-label="닫기"
              className="rounded-full px-2 text-2xl leading-none text-gray-500 hover:text-gray-800 disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </div>

        <div className="overflow-y-auto">
          <div className="bg-gradient-to-b from-sky-100 via-green-50 to-amber-50 px-5 py-5">
            <PosiliAvatar
              characterImageUrl={characterImageUrl}
              loadout={loadout}
              previewOverride={previewOverride}
              sizeClassName="w-40 h-40 sm:w-48 sm:h-48"
            />
            {selected && (
              <p className="mt-3 text-center text-xs font-semibold text-pink-700">
                미리보기 중 · {selectedItem ? selectedItem.name : '기본'}
              </p>
            )}
          </div>

          <div className="flex gap-2 border-b border-gray-100 px-5 pt-4">
            {DECOR_SLOT_OPTIONS.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => {
                  setActiveSlot(slot.id)
                  setSelected(null)
                }}
                className={`rounded-t-xl px-4 py-2 text-sm font-semibold transition-colors ${
                  activeSlot === slot.id
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {slot.icon} {slot.label}
              </button>
            ))}
          </div>

          <div className="px-5 py-4">
            {activeSlotMeta && <p className="mb-3 text-xs text-gray-500">{activeSlotMeta.description}</p>}

            {isLoading ? (
              <p className="py-8 text-center text-sm text-gray-500">불러오는 중…</p>
            ) : loadError ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-600">{loadError}</p>
                <button
                  type="button"
                  onClick={load}
                  className="mt-3 rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
                >
                  다시 시도
                </button>
              </div>
            ) : (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                <li>
                  <DecorCard
                    label="기본"
                    isSelected={selected?.slot === activeSlot && selected.itemId === null}
                    isEquipped={!equippedId}
                    onClick={() => setSelected({ slot: activeSlot, itemId: null })}
                  />
                </li>
                {slotItems.map((item) => (
                  <li key={item.id}>
                    <DecorCard
                      label={item.name}
                      imageUrl={item.imageUrl}
                      rarity={item.rarity}
                      priceJelly={item.priceJelly}
                      owned={item.owned}
                      isSelected={selected?.itemId === item.id}
                      isEquipped={equippedId === item.id}
                      onClick={() => setSelected({ slot: activeSlot, itemId: item.id })}
                    />
                  </li>
                ))}
              </ul>
            )}

            {!isLoading && !loadError && slotItems.length === 0 && (
              <p className="mt-4 text-center text-sm text-gray-500">아직 판매 중인 {activeSlotMeta?.label} 아이템이 없어요.</p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-4">{renderAction()}</div>
      </div>
    </div>
  )
}

/**
 * 아이템 카드 1개
 * @param {Object} props
 * @param {string} props.label
 * @param {string} [props.imageUrl]
 * @param {string} [props.rarity]
 * @param {number} [props.priceJelly]
 * @param {boolean} [props.owned]
 * @param {boolean} props.isSelected
 * @param {boolean} props.isEquipped
 * @param {() => void} props.onClick
 */
function DecorCard({ label, imageUrl, rarity, priceJelly, owned, isSelected, isEquipped, onClick }) {
  const grade = rarity ? getGachaGradeMeta(rarity) : null

  let status = null
  if (isEquipped) status = <span className="text-green-700">착용 중</span>
  else if (owned) status = <span className="text-gray-500">보유</span>
  else if (priceJelly !== undefined) {
    status = <span className="text-pink-700">{priceJelly > 0 ? `🍮 ${priceJelly}` : '무료'}</span>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full flex-col items-center gap-1 rounded-2xl border-2 p-2 text-center transition-all ${
        isSelected
          ? 'border-pink-400 bg-pink-50 shadow-md'
          : isEquipped
            ? 'border-green-300 bg-green-50'
            : 'border-gray-200 bg-white hover:border-pink-200'
      }`}
    >
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-gray-50">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl text-gray-300" aria-hidden="true">
            ∅
          </span>
        )}
      </div>
      <span className="w-full truncate text-xs font-semibold text-gray-800">{label}</span>
      {grade && (
        <span className={`rounded-full border px-1.5 text-[10px] font-semibold ${grade.colorClass}`}>
          {grade.label}
        </span>
      )}
      {status && <span className="text-[11px] font-bold">{status}</span>}
    </button>
  )
}
