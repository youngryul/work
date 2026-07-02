/**

 * 포실이 농장 메인 뷰 — 젤리로 10단계까지 성장

 */

import { useCallback, useEffect, useState } from 'react'

import {

  FARM_MAX_STAGE,

  getFarmStageImage,

  getFarmStageLabel,

} from '../../constants/farm.js'

import { JELLY_EARNING_GUIDE } from '../../constants/jellyEarningGuide.js'

import {

  feedMilk,

  getFarmSettingsMap,

  getMilkFeedEvent,

  getMyFarmProgress,

} from '../../services/farmService.js'

import { useJellyBalance } from '../../hooks/useJellyBalance.js'

import { showToast, TOAST_TYPES } from '../Toast.jsx'

import ViewPageTitle from '../ViewPageTitle.jsx'



export default function FarmView() {

  const [progress, setProgress] = useState({

    stage: 1,

    xp: 0,

    farmUnlocked: false,

    nextStageXpRequired: 100,

    maxStage: FARM_MAX_STAGE,

  })

  const [milkEvent, setMilkEvent] = useState(null)

  const [settings, setSettings] = useState({})

  const [isLoading, setIsLoading] = useState(true)

  const [isFeeding, setIsFeeding] = useState(false)

  const [levelUpStage, setLevelUpStage] = useState(null)

  const { balance: jellyBalance } = useJellyBalance()



  const load = useCallback(async () => {

    setIsLoading(true)

    try {

      const [farmProgress, feedEvent, farmSettings] = await Promise.all([

        getMyFarmProgress(),

        getMilkFeedEvent(),

        getFarmSettingsMap(),

      ])

      setProgress(farmProgress)

      setMilkEvent(feedEvent)

      setSettings(farmSettings)

    } catch (error) {

      showToast(error?.message || '농장 정보를 불러오지 못했어요.', TOAST_TYPES.ERROR)

    } finally {

      setIsLoading(false)

    }

  }, [])



  useEffect(() => {

    load()

  }, [load])



  const stage = progress.stage

  const isMaxStage = stage >= FARM_MAX_STAGE

  const stageImage = getFarmStageImage(stage, settings)

  const nextRequired = progress.nextStageXpRequired || 100

  const xpPercent = isMaxStage

    ? 100

    : Math.min(100, Math.round((progress.xp / nextRequired) * 100))



  const canFeed =

    milkEvent &&

    !isMaxStage &&

    stage >= (milkEvent.minStage || 1) &&

    (milkEvent.maxStage == null || stage <= milkEvent.maxStage)

  const feedTitle = stage === 1 ? '분유 먹이기' : '음식 먹이기'

  const feedEmoji = stage === 1 ? '🍼' : '🍱'

  const stageGuideMessage =
    stage === 1
      ? '2단계로 가면 농장이 열려요.'
      : stage === 2
        ? '3단계로 가면 포실이를 뽑을 수 있어요 · 작물을 구입할 수 있어요.'
        : null



  const handleFeedMilk = async () => {

    if (!milkEvent || !canFeed) return

    if ((jellyBalance ?? 0) < milkEvent.jellyCost) {

      showToast('젤리가 부족해요. 아래 방법으로 젤리를 모아보세요!', TOAST_TYPES.ERROR)

      return

    }



    setIsFeeding(true)

    try {

      const result = await feedMilk()

      if (result?.leveledUp) {

        setLevelUpStage(result.stage)

        showToast(`${result.stage}단계로 성장했어요! 🌾`, TOAST_TYPES.SUCCESS)

      } else if (result?.xpAwarded > 0) {

        showToast(`${stage === 1 ? '분유' : '음식'}를 먹였어요! 성장 경험치 +${result.xpAwarded}`, TOAST_TYPES.SUCCESS)

      }

      await load()

    } catch (error) {

      showToast(error?.message || '분유 먹이기에 실패했어요.', TOAST_TYPES.ERROR)

    } finally {

      setIsFeeding(false)

    }

  }



  if (isLoading) {

    return (

      <div className="max-w-3xl mx-auto p-6 text-center text-gray-500">

        농장을 불러오는 중…

      </div>

    )

  }



  return (

    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 font-sans">

      <ViewPageTitle icon="🌾" title="포실이 농장">

        <p className="text-lg text-gray-600">

          젤리로 포실이에게 먹이를 주며 10단계까지 성장시켜 보세요!

        </p>

      </ViewPageTitle>



      {/* 캐릭터 & 성장 */}

      <div className="relative overflow-hidden rounded-3xl border-2 border-green-200 bg-gradient-to-b from-sky-100 via-green-50 to-amber-50 p-6 shadow-lg">

        <div className="text-center">

          <span className="inline-block mb-2 px-3 py-1 rounded-full bg-white/80 text-sm font-semibold text-green-700 border border-green-200">

            {getFarmStageLabel(stage)}

          </span>



          <div className={`mx-auto ${stage === 1 ? 'farm-baby-bounce' : ''}`}>

            <img

              src={stageImage}

              alt="포실이"

              className={`mx-auto object-contain drop-shadow-xl select-none ${

                stage === 1 ? 'w-40 h-40 sm:w-48 sm:h-48' : 'w-36 h-36 sm:w-44 sm:h-44'

              }`}

            />

          </div>



          {!isMaxStage && (

            <div className="mt-4 max-w-xs mx-auto">

              <div className="flex justify-between text-xs text-green-700 mb-1">

                <span>{stage}단계 → {stage + 1}단계</span>

                <span className="font-bold">

                  {progress.xp} / {nextRequired}

                </span>

              </div>

              <div className="h-3 bg-white/70 rounded-full overflow-hidden border border-green-200">

                <div

                  className="h-full bg-gradient-to-r from-pink-400 to-orange-400 rounded-full transition-all duration-500"

                  style={{ width: `${xpPercent}%` }}

                />

              </div>

              {stageGuideMessage && (

                <p className="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">

                  {stageGuideMessage}

                </p>

              )}

            </div>

          )}



          {isMaxStage && (

            <p className="mt-4 text-sm font-semibold text-green-700">

              최고 단계에 도달했어요! 🎉

            </p>

          )}

        </div>

      </div>



      {/* 먹이 주기 */}

      {canFeed && milkEvent && (

        <section className="rounded-2xl bg-white border-2 border-pink-100 p-5 shadow-sm">

          <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">

            <span>{feedEmoji}</span> {feedTitle}

          </h2>

          <p className="text-sm text-gray-600 mb-4">

            젤리 {milkEvent.jellyCost}개를 사용해 {stage === 1 ? '분유' : '음식'}를 먹이면 성장 경험치 +{milkEvent.xpAmount}를

            얻어요.

          </p>

          <button

            type="button"

            onClick={handleFeedMilk}

            disabled={isFeeding || (jellyBalance ?? 0) < milkEvent.jellyCost}

            className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-400 text-white font-bold shadow-md hover:from-pink-600 hover:to-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"

          >

            {isFeeding

              ? '먹이는 중…'

              : `${feedEmoji} ${feedTitle} (젤리 ${milkEvent.jellyCost} · XP +${milkEvent.xpAmount})`}

          </button>

          <p className="mt-2 text-xs text-center text-gray-500">

            보유 젤리: {jellyBalance ?? 0}개

          </p>

        </section>

      )}



      {/* 젤리 획득 방법 */}

      <section className="rounded-2xl bg-white border-2 border-amber-100 p-5 shadow-sm">

        <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">

          <span>🍬</span> 젤리 얻는 방법

        </h2>

        <p className="text-sm text-gray-600 mb-4">

          일상 활동으로 젤리를 모아 포실이에게 먹이를 주세요.

        </p>

        <ul className="space-y-2">

          {JELLY_EARNING_GUIDE.map((item) => (

            <li

              key={item.id}

              className="flex items-center justify-between gap-3 rounded-xl bg-amber-50/60 border border-amber-100 px-4 py-3"

            >

              <div className="flex items-start gap-3 min-w-0">

                <span className="text-xl shrink-0">{item.icon}</span>

                <div className="min-w-0">

                  <p className="font-semibold text-gray-800">{item.label}</p>

                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>

                </div>

              </div>

              <span className="shrink-0 text-sm font-bold text-amber-600">

                +{item.amount}

              </span>

            </li>

          ))}

        </ul>

      </section>



      {/* 단계 업 모달 */}

      {levelUpStage && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-2 border-green-200 animate-gacha-pop">

            <img

              src={getFarmStageImage(levelUpStage, settings)}

              alt="포실이"

              className="w-32 h-32 mx-auto object-contain mb-4"

            />

            <h3 className="text-2xl font-bold text-green-800 mb-2">

              {levelUpStage}단계로 성장!

            </h3>

            <p className="text-gray-600 text-sm mb-6">

              {levelUpStage >= FARM_MAX_STAGE

                ? '포실이가 최고 단계까지 자랐어요!'

                : '포실이가 한 단계 더 자랐어요. 계속 키워보세요!'}

            </p>

            <button

              type="button"

              onClick={() => setLevelUpStage(null)}

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


