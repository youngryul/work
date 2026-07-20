import { useMemo, useState } from 'react'
import { FARM_CROP_REQUEST_HINT, formatCropRequestJellyPreview } from '../../constants/farmHarvest.js'

/**
 * 수량 스테퍼 (작물 요청)
 */
function GiveQuantityStepper({ value, onChange, min = 1, max = 1, disabled = false }) {
  const current = Math.min(max, Math.max(min, Number(value) || min))

  return (
    <div className="inline-flex items-center gap-2 select-none">
      <button
        type="button"
        disabled={disabled || current <= min}
        onClick={() => onChange(current - 1)}
        className="w-9 h-9 rounded-lg border-2 border-green-200 bg-white font-semibold hover:bg-green-50 disabled:opacity-40"
        aria-label="수량 줄이기"
      >
        −
      </button>
      <span className="w-10 text-center font-bold tabular-nums">{current}</span>
      <button
        type="button"
        disabled={disabled || current >= max}
        onClick={() => onChange(current + 1)}
        className="w-9 h-9 rounded-lg border-2 border-green-200 bg-white font-semibold hover:bg-green-50 disabled:opacity-40"
        aria-label="수량 늘리기"
      >
        +
      </button>
    </div>
  )
}

/**
 * 캐릭터 작물 요청 이벤트
 * @param {Object} props
 * @param {Object|null} props.request
 * @param {boolean} props.isSubmitting
 * @param {Array} [props.warehouse]
 * @param {Record<string, string>} [props.farmSettings]
 * @param {(quantity: number) => void} props.onFulfill
 */
export default function FarmCropRequestEvent({
  request,
  warehouse = [],
  farmSettings = {},
  isSubmitting,
  onFulfill,
}) {
  const stockForCrop = useMemo(() => {
    if (!request) return 0
    const row = warehouse.find((w) => w.cropGachaCharacterId === request.cropGachaCharacterId)
    return row?.quantity ?? request.warehouseQuantity ?? 0
  }, [request, warehouse])

  const maxGive = useMemo(() => {
    if (!request) return 1
    return Math.max(1, Math.min(request.maxQuantity, stockForCrop))
  }, [request, stockForCrop])

  const [giveQty, setGiveQty] = useState(1)

  if (!request) return null

  const effectiveQty = Math.min(giveQty, maxGive)
  const jellyPreview = formatCropRequestJellyPreview(effectiveQty, farmSettings)

  return (
    <section className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-pink-50 p-4 sm:p-5 shadow-md space-y-4">
      <p className="text-sm text-violet-800 font-medium">{FARM_CROP_REQUEST_HINT}</p>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {request.requesterImageUrl ? (
          <img
            src={request.requesterImageUrl}
            alt={request.requesterName}
            className="w-20 h-20 object-contain drop-shadow"
          />
        ) : (
          <span className="text-5xl" aria-hidden>
            🐾
          </span>
        )}

        <div className="flex-1 text-center sm:text-left space-y-2">
          <p className="text-lg font-bold text-gray-800">
            <span className="text-violet-700">{request.requesterName}</span>
            이(가) 말했어요
          </p>
          <p className="text-gray-700 font-sans">
            「{request.cropName}」을(를){' '}
            <span className="font-semibold text-violet-800">최대 {request.maxQuantity}개</span>
            까지 줄 수 있을까요?
          </p>
        </div>

        {request.cropImageUrl ? (
          <img
            src={request.cropImageUrl}
            alt={request.cropName}
            className="w-16 h-16 object-contain"
          />
        ) : (
          <span className="text-4xl">🌽</span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-violet-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 font-sans">줄 작물 수</span>
            <GiveQuantityStepper
              value={effectiveQty}
              min={1}
              max={maxGive}
              disabled={isSubmitting}
              onChange={(next) => setGiveQty(next)}
            />
            <span className="text-xs text-gray-500">(창고 {stockForCrop}개)</span>
          </div>
          <p className="text-sm font-semibold text-violet-800 font-sans">
            받을 젤리: <span className="tabular-nums">{jellyPreview}</span>
            <span className="text-xs font-normal text-violet-600 ml-1">(랜덤)</span>
          </p>
        </div>
        <button
          type="button"
          disabled={isSubmitting || maxGive < 1}
          onClick={() => onFulfill(effectiveQty)}
          className="px-6 py-2.5 rounded-xl bg-violet-500 text-white font-bold hover:bg-violet-600 disabled:bg-gray-300 shadow-md whitespace-nowrap"
        >
          {isSubmitting ? '전달 중…' : `🍮 ${effectiveQty}개 주기 · ${jellyPreview}`}
        </button>
      </div>
    </section>
  )
}
