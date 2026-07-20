import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CROP_MAX_STAGE,
  FARM_FIELD_COLS,
  FARM_FIELD_ROWS,
  getCropStageLabel,
  getCropStageMeta,
  getCropXpPercent,
  getFieldHarvestStats,
  hasCropHarvestImage,
} from '../../constants/farmField.js'
import { FARM_HARVEST_READY_MESSAGE } from '../../constants/farmHarvest.js'
import { useJellyBalance } from '../../hooks/useJellyBalance.js'
import {
  fulfillFarmCropRequest,
  getFarmSettingsMap,
  getFarmWarehouseState,
  getMyFarmField,
  harvestFarmField,
  plantFarmSeed,
  waterFarmCrop,
} from '../../services/farmService.js'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import ViewPageTitle from '../ViewPageTitle.jsx'
import FarmCropRequestEvent from './FarmCropRequestEvent.jsx'
import FarmHarvestModal from './FarmHarvestModal.jsx'
import FarmWarehousePanel from './FarmWarehousePanel.jsx'

function renderCropCellContent(crop) {
  if (hasCropHarvestImage(crop)) {
    return (
      <img
        src={crop.cropImageUrl}
        alt={crop.cropName || '작물'}
        className="w-[78%] h-[78%] object-contain drop-shadow-md"
        draggable={false}
      />
    )
  }
  return (
    <span className="text-2xl sm:text-3xl drop-shadow-md select-none">
      {getCropStageMeta(crop.stage).emoji}
    </span>
  )
}

/**
 * @param {number} row
 * @param {number} col
 */
function findCropAt(crops, row, col) {
  return crops.find((crop) => crop.row === row && crop.col === col) ?? null
}

export default function FarmFieldView() {
  const [field, setField] = useState({
    seedCount: 0,
    crops: [],
    waterXpAmount: 15,
    waterJellyCost: 10,
    canHarvest: false,
    fieldCropCount: 0,
    matureCropCount: 0,
  })
  const [warehouseState, setWarehouseState] = useState({
    warehouse: [],
    activeRequest: null,
    totalWarehouseCount: 0,
  })
  const [farmSettings, setFarmSettings] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isPlanting, setIsPlanting] = useState(false)
  const [isWatering, setIsWatering] = useState(false)
  const [isHarvesting, setIsHarvesting] = useState(false)
  const [isFulfillingRequest, setIsFulfillingRequest] = useState(false)
  const [showHarvestModal, setShowHarvestModal] = useState(false)
  const [plantMode, setPlantMode] = useState(false)
  const [selectedCropId, setSelectedCropId] = useState(null)
  const [cropLevelUpStage, setCropLevelUpStage] = useState(null)

  const { balance: jellyBalance } = useJellyBalance()

  const fieldHarvestStats = useMemo(
    () => getFieldHarvestStats(field.crops),
    [field.crops],
  )

  /** 밭 작물 전부 완성 → 씨앗/물주기 대신 수확만 */
  const isHarvestReady = fieldHarvestStats.allMature

  /** 완성 작물 1개 이상 (부분 수확 가능) */
  const canHarvestAnyMature = fieldHarvestStats.mature > 0

  useEffect(() => {
    if (isHarvestReady) {
      setPlantMode(false)
    }
  }, [isHarvestReady])

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [data, wh, settings] = await Promise.all([
        getMyFarmField(),
        getFarmWarehouseState(),
        getFarmSettingsMap(),
      ])
      setField(data)
      setWarehouseState(wh)
      setFarmSettings(settings)
      setSelectedCropId((prev) => {
        if (!prev) return prev
        return data.crops.some((crop) => crop.id === prev) ? prev : null
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selectedCrop = useMemo(
    () => field.crops.find((crop) => crop.id === selectedCropId) ?? null,
    [field.crops, selectedCropId],
  )

  const canPlant = !isHarvestReady && field.seedCount > 0 && !isPlanting
  const canWater =
    !isHarvestReady &&
    selectedCrop &&
    selectedCrop.stage < CROP_MAX_STAGE &&
    !isWatering &&
    (jellyBalance ?? 0) >= field.waterJellyCost

  const harvestPreview = useMemo(
    () =>
      fieldHarvestStats.matureCrops.map((crop) => ({
        cropGachaCharacterId: crop.id,
        cropName: crop.cropName,
        cropImageUrl: crop.cropImageUrl,
      })),
    [fieldHarvestStats.matureCrops],
  )

  const handleHarvest = async () => {
    setIsHarvesting(true)
    try {
      const result = await harvestFarmField()
      setWarehouseState({
        warehouse: result?.warehouse ?? [],
        activeRequest: result?.activeRequest ?? null,
        totalWarehouseCount: (result?.warehouse ?? []).reduce((sum, row) => sum + row.quantity, 0),
      })
      setSelectedCropId(null)
      setShowHarvestModal(false)
      await load()
      showToast(
        `수확 완료! 작물 ${result?.harvestedCount ?? 0}개를 창고에 넣었어요.`,
        TOAST_TYPES.SUCCESS,
      )
    } catch (error) {
      showToast(error?.message || '수확에 실패했어요.', TOAST_TYPES.ERROR)
    } finally {
      setIsHarvesting(false)
    }
  }

  const handleFulfillRequest = async (quantity) => {
    const req = warehouseState.activeRequest
    if (!req?.id) return

    setIsFulfillingRequest(true)
    try {
      const result = await fulfillFarmCropRequest(req.id, quantity)
      setWarehouseState({
        warehouse: result?.warehouse ?? [],
        activeRequest: result?.activeRequest ?? null,
        totalWarehouseCount: (result?.warehouse ?? []).reduce((sum, row) => sum + row.quantity, 0),
      })
      if (result?.jellyAwarded > 0) {
        showToast(`고마워요! 젤리 +${result.jellyAwarded} 🍮`, TOAST_TYPES.SUCCESS)
      }
    } catch (error) {
      showToast(error?.message || '작물 전달에 실패했어요.', TOAST_TYPES.ERROR)
    } finally {
      setIsFulfillingRequest(false)
    }
  }

  const handleTogglePlantMode = () => {
    if (isHarvestReady) return
    if (field.seedCount < 1) {
      showToast('씨앗이 없어요. 포실이 2단계 달성 시 씨앗을 받을 수 있어요!', TOAST_TYPES.ERROR)
      return
    }
    setPlantMode((prev) => !prev)
    setSelectedCropId(null)
  }

  const handleCellClick = async (row, col) => {
    const crop = findCropAt(field.crops, row, col)

    if (plantMode) {
      if (isHarvestReady) return
      if (crop) {
        showToast('이미 작물이 있는 칸이에요.', TOAST_TYPES.ERROR)
        return
      }
      setIsPlanting(true)
      try {
        const result = await plantFarmSeed(row, col)
        setField((prev) => ({
          ...prev,
          seedCount: result?.seedCount ?? prev.seedCount,
          crops: result?.crop ? [...prev.crops, result.crop] : prev.crops,
        }))
        setSelectedCropId(result?.crop?.id ?? null)
        setPlantMode(false)
        showToast('씨앗을 심었어요! 물을 주며 키워보세요.', TOAST_TYPES.SUCCESS)
      } catch (error) {
        showToast(error?.message || '씨앗 심기에 실패했어요.', TOAST_TYPES.ERROR)
      } finally {
        setIsPlanting(false)
      }
      return
    }

    if (crop) {
      setSelectedCropId(crop.id)
    } else {
      setSelectedCropId(null)
    }
  }

  const handleWater = async () => {
    if (!selectedCrop || selectedCrop.stage >= CROP_MAX_STAGE) return
    if ((jellyBalance ?? 0) < field.waterJellyCost) {
      showToast('젤리가 부족해요. 젤리를 모은 뒤 물을 주세요!', TOAST_TYPES.ERROR)
      return
    }

    setIsWatering(true)
    try {
      const result = await waterFarmCrop(selectedCrop.id)
      if (result?.crop) {
        setField((prev) => ({
          ...prev,
          crops: prev.crops.map((crop) => (crop.id === result.crop.id ? result.crop : crop)),
        }))
        setSelectedCropId(result.crop.id)
      }
      if (result?.leveledUp && result?.newStage) {
        setCropLevelUpStage(result.newStage)
        const meta = getCropStageMeta(result.newStage)
        showToast(`${meta.label} 단계로 자랐어요! ${meta.emoji}`, TOAST_TYPES.SUCCESS)
      } else if (result?.xpAwarded > 0) {
        showToast(`물을 줬어요! 성장 경험치 +${result.xpAwarded}`, TOAST_TYPES.SUCCESS)
      }
      await load()
    } catch (error) {
      showToast(error?.message || '물주기에 실패했어요.', TOAST_TYPES.ERROR)
    } finally {
      setIsWatering(false)
    }
  }

  const rows = Array.from({ length: FARM_FIELD_ROWS }, (_, row) => row)
  const cols = Array.from({ length: FARM_FIELD_COLS }, (_, col) => col)

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 font-sans">
      <ViewPageTitle icon="🌾" title="농장">
        <p className="text-lg text-gray-600">
          5×4 밭에 씨앗을 심고 물을 주며 씨앗 → 새싹 → 꽃 → 작물까지 키워보세요!
        </p>
      </ViewPageTitle>

      <section className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-green-900">
          <span className="text-2xl" aria-hidden>
            🫘
          </span>
          <span className="font-semibold">보유 씨앗</span>
        </div>
        <span className="text-lg font-bold text-green-800 tabular-nums">
          {isLoading ? '…' : `${field.seedCount}개`}
        </span>
      </section>

      <FarmWarehousePanel
        warehouse={warehouseState.warehouse}
        totalCount={warehouseState.totalWarehouseCount}
      />

      <FarmCropRequestEvent
        key={warehouseState.activeRequest?.id ?? 'none'}
        request={warehouseState.activeRequest}
        warehouse={warehouseState.warehouse}
        farmSettings={farmSettings}
        isSubmitting={isFulfillingRequest}
        onFulfill={handleFulfillRequest}
      />

      <section className="rounded-3xl border-2 border-orange-200 bg-gradient-to-b from-orange-100 via-amber-50 to-rose-50 p-4 sm:p-5 shadow-lg">
        <div className="relative w-full aspect-[5/4] max-h-[420px] mx-auto">
          <img
            src="/images/밭.png"
            alt="포실이 농장 밭"
            className="absolute inset-0 w-full h-full rounded-2xl border border-orange-100 shadow-md object-cover"
          />
          <div
            className="absolute inset-[8%] grid gap-1 sm:gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${FARM_FIELD_COLS}, 1fr)`,
              gridTemplateRows: `repeat(${FARM_FIELD_ROWS}, 1fr)`,
            }}
          >
            {rows.map((row) =>
              cols.map((col) => {
                const crop = findCropAt(field.crops, row, col)
                const isSelected = crop?.id === selectedCropId
                const isEmpty = !crop
                const isPlantTarget = plantMode && isEmpty

                return (
                  <button
                    key={`${row}-${col}`}
                    type="button"
                    disabled={isPlanting}
                    onClick={() => handleCellClick(row, col)}
                    className={[
                      'relative rounded-lg border-2 transition-all flex items-center justify-center min-h-0',
                      'bg-black/10 backdrop-blur-[1px]',
                      isPlantTarget
                        ? 'border-dashed border-green-400 bg-green-200/40 hover:bg-green-300/50 animate-pulse'
                        : isSelected
                          ? 'border-sky-400 bg-sky-200/50 ring-2 ring-sky-300'
                          : crop
                            ? 'border-amber-300/80 bg-amber-100/30 hover:bg-amber-100/50'
                            : 'border-transparent hover:border-white/40 hover:bg-white/10',
                    ].join(' ')}
                    aria-label={
                      crop
                        ? `${getCropStageLabel(crop.stage)} (${row + 1}행 ${col + 1}열)`
                        : `빈 칸 (${row + 1}행 ${col + 1}열)`
                    }
                  >
                    {crop ? (
                      renderCropCellContent(crop)
                    ) : plantMode ? (
                      <span className="text-green-700 text-xl opacity-70">+</span>
                    ) : null}
                  </button>
                )
              }),
            )}
          </div>
        </div>

        {plantMode && (
          <p className="mt-3 text-center text-sm text-green-800 font-medium">
            심을 칸을 눌러 주세요 (씨앗 1개 소모)
          </p>
        )}
      </section>

      {selectedCrop && (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {hasCropHarvestImage(selectedCrop) ? (
                <img
                  src={selectedCrop.cropImageUrl}
                  alt={selectedCrop.cropName || '작물'}
                  className="w-12 h-12 object-contain"
                />
              ) : (
                <span className="text-3xl">{getCropStageMeta(selectedCrop.stage).emoji}</span>
              )}
              <div>
                <p className="font-bold text-sky-900">
                  {hasCropHarvestImage(selectedCrop) && selectedCrop.cropName
                    ? selectedCrop.cropName
                    : getCropStageLabel(selectedCrop.stage)}
                </p>
                <p className="text-sm text-sky-700">
                  {selectedCrop.row + 1}행 {selectedCrop.col + 1}열
                </p>
              </div>
            </div>
            {selectedCrop.stage < CROP_MAX_STAGE && (
              <p className="text-sm text-sky-800 tabular-nums">
                {selectedCrop.xp} / {selectedCrop.nextStageXpRequired ?? '—'} XP
              </p>
            )}
          </div>
          {selectedCrop.stage < CROP_MAX_STAGE ? (
            <div className="h-3 rounded-full bg-sky-200 overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-500 rounded-full"
                style={{ width: `${getCropXpPercent(selectedCrop)}%` }}
              />
            </div>
          ) : (
            <p className="text-sm text-green-700 font-medium">
              {selectedCrop.cropName
                ? `${selectedCrop.cropName}이(가) 완전히 자랐어요! 🎉`
                : '완전히 자란 작물이에요! 🎉'}
            </p>
          )}
        </section>
      )}

      <div className="flex flex-col gap-3">
        {isHarvestReady ? (
          <div className="space-y-2">
            <p className="text-center text-sm text-amber-900 font-medium">{FARM_HARVEST_READY_MESSAGE}</p>
            <button
              type="button"
              onClick={() => setShowHarvestModal(true)}
              disabled={isHarvesting}
              className={[
                'w-full py-3 px-4 rounded-xl font-bold text-white shadow-md transition-colors',
                isHarvesting ? 'bg-amber-300 cursor-wait' : 'bg-amber-500 hover:bg-amber-600',
              ].join(' ')}
            >
              {isHarvesting
                ? '수확 중…'
                : `🌾 수확하기 (작물 ${fieldHarvestStats.mature}개 → 창고)`}
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleTogglePlantMode}
                disabled={!canPlant && !plantMode}
                className={[
                  'flex-1 py-3 px-4 rounded-xl font-bold text-white shadow-md transition-colors',
                  plantMode
                    ? 'bg-gray-500 hover:bg-gray-600'
                    : canPlant
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-300 cursor-not-allowed',
                ].join(' ')}
              >
                {plantMode ? '심기 취소' : '🫘 씨앗 심기'}
              </button>
              <button
                type="button"
                onClick={handleWater}
                disabled={!canWater}
                className={[
                  'flex-1 py-3 px-4 rounded-xl font-bold text-white shadow-md transition-colors',
                  canWater ? 'bg-sky-500 hover:bg-sky-600' : 'bg-gray-300 cursor-not-allowed',
                ].join(' ')}
              >
                {isWatering
                  ? '물 주는 중…'
                  : `💧 물 주기 (젤리 ${field.waterJellyCost} · 경험치 +${field.waterXpAmount})`}
              </button>
            </div>
            {canHarvestAnyMature && (
              <button
                type="button"
                onClick={() => setShowHarvestModal(true)}
                disabled={isHarvesting}
                className={[
                  'w-full py-3 px-4 rounded-xl font-bold text-white shadow-md transition-colors',
                  isHarvesting ? 'bg-amber-300 cursor-wait' : 'bg-amber-500 hover:bg-amber-600',
                ].join(' ')}
              >
                {isHarvesting
                  ? '수확 중…'
                  : `🌾 완성 작물 수확 (${fieldHarvestStats.mature}개 → 창고)`}
              </button>
            )}
            {fieldHarvestStats.total > 0 && !isHarvestReady && (
              <p className="text-center text-xs text-amber-800">
                완성 {fieldHarvestStats.mature}/{fieldHarvestStats.total} — 밭 전체가 다 자라면 씨앗·물주기 대신
                수확만 할 수 있어요.
              </p>
            )}
          </>
        )}
      </div>

      <section className="rounded-2xl border border-orange-100 bg-orange-50/80 p-4 text-sm text-orange-900 space-y-1">
        <p className="font-semibold">성장 단계</p>
        <p>🫘 씨앗 → 🌱 새싹 → 🌸 꽃 → 🌽 작물 (포실이처럼 경험치를 쌓으며 성장해요)</p>
        <p>물을 줄 때마다 젤리를 쓰고 성장 경험치가 올라가요.</p>
        <p>밭의 작물이 모두 자라면 수확해 창고에 보관하고, 친구들의 작물 요청에 응하면 젤리를 받을 수 있어요.</p>
      </section>

      <FarmHarvestModal
        open={showHarvestModal}
        cropCount={fieldHarvestStats.mature}
        previewCrops={harvestPreview}
        isHarvesting={isHarvesting}
        onConfirm={handleHarvest}
        onClose={() => setShowHarvestModal(false)}
      />

      {cropLevelUpStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-2 border-green-200">
            {cropLevelUpStage >= CROP_MAX_STAGE && field.crops.find((c) => c.id === selectedCropId)?.cropImageUrl ? (
              <img
                src={field.crops.find((c) => c.id === selectedCropId)?.cropImageUrl}
                alt="작물"
                className="w-24 h-24 mx-auto object-contain mb-4"
              />
            ) : (
              <span className="text-6xl block mb-4">{getCropStageMeta(cropLevelUpStage).emoji}</span>
            )}
            <h3 className="text-2xl font-bold text-green-800 mb-2">
              {cropLevelUpStage >= CROP_MAX_STAGE &&
              field.crops.find((c) => c.id === selectedCropId)?.cropName
                ? field.crops.find((c) => c.id === selectedCropId)?.cropName
                : `${getCropStageMeta(cropLevelUpStage).label} 단계!`}
            </h3>
            <p className="text-gray-600 text-sm mb-6">
              {cropLevelUpStage >= CROP_MAX_STAGE
                ? '작물이 완전히 자랐어요!'
                : '계속 물을 주며 키워보세요!'}
            </p>
            <button
              type="button"
              onClick={() => setCropLevelUpStage(null)}
              className="px-8 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
