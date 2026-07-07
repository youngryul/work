import { useEffect, useState } from 'react'
import { SHOP_PURCHASE_TYPES, SHOP_SEED_MAX_QUANTITY } from '../../constants/shop.js'
import { useJellyBalance } from '../../hooks/useJellyBalance.js'
import { useAiTokenInfo } from '../../hooks/useAiTokenInfo.js'
import { getMyFarmProgress } from '../../services/farmService.js'
import { getShopSeedJellyCost, purchaseSeedsWithJelly } from '../../services/shopService.js'
import TokenDepositRequestModal from '../TokenDepositRequestModal.jsx'
import { showToast, TOAST_TYPES } from '../Toast.jsx'
import ViewPageTitle from '../ViewPageTitle.jsx'

/**
 * 상점 — 씨앗(젤리), 젤리·토큰(무통장) 구매
 */
export default function ShopView() {
  const { balance: jellyBalance, reload: refreshJelly } = useJellyBalance()
  const { balance: tokenBalance, generationCost } = useAiTokenInfo()

  const [seedCount, setSeedCount] = useState(0)
  const [seedJellyCost, setSeedJellyCost] = useState(10)
  const [seedQuantity, setSeedQuantity] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isPurchasingSeed, setIsPurchasingSeed] = useState(false)
  const [depositModal, setDepositModal] = useState(null)

  const totalSeedJelly = seedJellyCost * seedQuantity
  const canBuySeed =
    !isPurchasingSeed &&
    seedQuantity >= 1 &&
    seedQuantity <= SHOP_SEED_MAX_QUANTITY &&
    (jellyBalance ?? 0) >= totalSeedJelly

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const [progress, cost] = await Promise.all([
          getMyFarmProgress(),
          getShopSeedJellyCost(),
        ])
        setSeedCount(progress.seedCount ?? 0)
        setSeedJellyCost(cost)
      } catch {
        setSeedCount(0)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handlePurchaseSeed = async () => {
    if (!canBuySeed) return
    setIsPurchasingSeed(true)
    try {
      const result = await purchaseSeedsWithJelly(seedQuantity)
      setSeedCount(result.seedCount)
      await refreshJelly()
      showToast(
        `씨앗 ${result.purchased}개를 구매했습니다. (젤리 ${result.jellySpent}개 사용)`,
        TOAST_TYPES.SUCCESS,
      )
      setSeedQuantity(1)
    } catch (error) {
      showToast(error?.message || '씨앗 구매에 실패했습니다.', TOAST_TYPES.ERROR)
    } finally {
      setIsPurchasingSeed(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-gray-500 font-sans">
        로딩 중...
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 font-sans">
      <ViewPageTitle title="상점" emoji="🛒" />

      <p className="text-sm text-gray-600 -mt-2">
        씨앗은 젤리로 즉시 구매하고, 젤리·AI 토큰은 무통장 입금 후 충전 신청할 수 있습니다.
      </p>

      {/* 씨앗 */}
      <section className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-green-900">🌱 씨앗</h2>
            <p className="text-sm text-green-800 mt-1">
              농장에 작물을 심을 때 사용합니다. 젤리로 즉시 구매됩니다.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-green-700">보유 씨앗</p>
            <p className="text-2xl font-bold text-green-900">{seedCount}개</p>
          </div>
        </div>

        <div className="rounded-xl bg-white border border-green-200 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-700">
              가격: <strong className="text-green-800">{seedJellyCost}젤리</strong> / 1개
            </p>
            <p className="text-sm text-gray-600">
              보유 젤리: <strong>{jellyBalance ?? 0}개</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 mb-1 block">구매 수량</span>
              <input
                type="number"
                min={1}
                max={SHOP_SEED_MAX_QUANTITY}
                value={seedQuantity}
                onChange={(e) => setSeedQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </label>
            <p className="text-sm text-gray-600 pb-2">
              합계: <strong className="text-green-800">{totalSeedJelly}젤리</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={handlePurchaseSeed}
            disabled={!canBuySeed}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isPurchasingSeed
              ? '구매 중...'
              : canBuySeed
                ? `젤리 ${totalSeedJelly}개로 씨앗 ${seedQuantity}개 구매`
                : (jellyBalance ?? 0) < totalSeedJelly
                  ? '젤리가 부족합니다'
                  : '구매하기'}
          </button>
        </div>
      </section>

      {/* 젤리 */}
      <section className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-rose-50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-pink-900">🍬 젤리</h2>
            <p className="text-sm text-pink-800 mt-1">
              포실이 먹이, 가챠, 농장 활동에 사용합니다.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-pink-700">보유 젤리</p>
            <p className="text-2xl font-bold text-pink-900">{jellyBalance ?? 0}개</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDepositModal(SHOP_PURCHASE_TYPES.JELLY)}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold hover:opacity-90 transition-opacity"
        >
          무통장 입금 · 젤리 충전 신청
        </button>
      </section>

      {/* AI 토큰 */}
      <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-amber-900">✨ AI 토큰</h2>
            <p className="text-sm text-amber-800 mt-1">
              일기 AI 그림 생성에 사용합니다. (1회 {generationCost}토큰)
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-amber-700">보유 토큰</p>
            <p className="text-2xl font-bold text-amber-900">{tokenBalance ?? 0}개</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDepositModal(SHOP_PURCHASE_TYPES.AI_TOKEN)}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:opacity-90 transition-opacity"
        >
          무통장 입금 · 토큰 충전 신청
        </button>
      </section>

      <TokenDepositRequestModal
        isOpen={depositModal != null}
        onClose={() => setDepositModal(null)}
        purchaseType={depositModal || SHOP_PURCHASE_TYPES.AI_TOKEN}
        tokenBalance={tokenBalance}
        jellyBalance={jellyBalance}
        generationCost={generationCost}
      />
    </div>
  )
}
